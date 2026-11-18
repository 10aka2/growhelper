/**
 * Panel state regression tests (issue #18), runnable without a browser:
 * loads the committed served bundle in a minimal DOM mock and drives the
 * panel with a mocked hass object.
 *
 * Covers:
 * - the active Grow Run is discovered from the backend (get_diary_content)
 *   and survives subsequent hass updates (no more state wipe)
 * - a failed start_grow_run renders a visible error banner
 * - device toggles (issue #28): device cards call the generic HA services
 *   (turn_on/turn_off of the entity's own domain), failures render the
 *   error banner
 * - the admin-only Growth Phase selector (issue #29): admins get the
 *   <select>, non-admins the read-only label, changes call
 *   growhelper.set_growth_phase, failures render the error banner
 * - quick diary entry per Plant card (issue #31): opens the entry form with
 *   the plant tag prefilled
 *
 * Usage: node --test tests/e2e/panel-state.mjs
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const bundlePath = path.join(
  repoRoot,
  "custom_components/growhelper/www/growhelper-panel.js",
);

function loadPanelClass() {
  const source = readFileSync(bundlePath, "utf8");
  class HTMLElementMock {
    attachShadow() {
      this.shadowRoot = {
        innerHTML: "",
        addEventListener() {},
        removeEventListener() {},
      };
    }
  }
  const sandbox = {
    HTMLElement: HTMLElementMock,
    window: {},
    customElements: {
      define: (name, cls) => {
        sandbox.__panelClass = cls;
      },
      get: () => undefined,
    },
    document: {
      createElement: () => {
        const el = { _text: "" };
        Object.defineProperty(el, "textContent", {
          set(v) {
            el._text = String(v);
          },
          get() {
            return el._text;
          },
        });
        Object.defineProperty(el, "innerHTML", {
          get() {
            return el._text;
          },
        });
        return el;
      },
    },
    console,
  };
  sandbox.window.customElements = sandbox.customElements;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.__panelClass;
}

// The config state carries no active_grow_run — the sensor only publishes it
// once a Grow Run is active (ADR-0003), so this fixture covers the pre-run
// state the panel must handle via backend discovery.
function makeHass(callService) {
  return {
    states: {
      "sensor.growhelper_config": {
        state: "configured",
        attributes: { canopy_temperature: "sensor.canopy_temperature" },
      },
      "sensor.canopy_temperature": { state: "24.5", attributes: {} },
    },
    callService,
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test("active Grow Run is discovered from the backend and survives hass updates", async () => {
  const Panel = loadPanelClass();
  const hass = makeHass((domain, service) => {
    if (service === "get_diary_content") {
      return Promise.resolve({
        response: { run_name: "grow_run_20261106", content: "## 06.11.2026\n" },
      });
    }
    return Promise.resolve({});
  });

  const panel = new Panel();
  panel.hass = hass;
  await flush();
  await flush();
  assert.equal(
    panel._activeGrowRun,
    "grow_run_20261106",
    "panel should discover the active run via get_diary_content",
  );

  // The next hass update must not wipe the run back to the empty state.
  panel.hass = { ...hass, states: { ...hass.states } };
  await flush();
  await flush();
  assert.equal(
    panel._activeGrowRun,
    "grow_run_20261106",
    "active run must survive hass updates (issue #18)",
  );
  assert.ok(
    panel.shadowRoot.innerHTML.includes("grow_run_20261106"),
    "the active run is rendered in the diary section",
  );
});

test("failed start_grow_run renders a visible error banner", async () => {
  const Panel = loadPanelClass();
  const hass = makeHass((domain, service) => {
    if (service === "start_grow_run") {
      return Promise.reject({
        message: "A Grow Run with name 'grow_run_20261106' already exists.",
      });
    }
    return Promise.resolve({ response: { run_name: "", content: "" } });
  });

  const panel = new Panel();
  panel.hass = hass;
  await flush();
  await flush();

  panel._startNewGrowRun();
  await flush();
  await flush();

  assert.ok(panel._errorMessage.length > 0, "error message is set");
  assert.ok(
    panel.shadowRoot.innerHTML.includes("error-banner"),
    "the error banner is rendered in the panel",
  );
});

// --- Device toggles (issue #28): device cards call the generic HA services ---

// hass mock with the climate/light Entity Roles mapped and their states set.
function makeDeviceHass(callService, states) {
  return {
    states: {
      "sensor.growhelper_config": {
        state: "configured",
        attributes: {
          canopy_temperature: "sensor.canopy_temperature",
          humidifier: "switch.humidifier",
          dehumidifier: "switch.dehumidifier",
          exhaust_fan: "switch.exhaust_fan",
          ventilation_fan: "switch.ventilation_fan",
          grow_light: "switch.grow_light",
        },
      },
      "sensor.canopy_temperature": { state: "24.5", attributes: {} },
      ...states,
    },
    callService,
  };
}

// Minimal fake DOM element carrying data-action/data-entity-id, as the click
// delegation would find it on a device card.
function fakeCardTarget(entityId) {
  return {
    classList: { contains: () => false },
    getAttribute: (name) =>
      name === "data-action" ? "toggle-device" : name === "data-entity-id" ? entityId : null,
    parentElement: null,
  };
}

test("device cards render as toggleable and an 'on' device is turned off", async () => {
  const Panel = loadPanelClass();
  const calls = [];
  const hass = makeDeviceHass(
    (domain, service, data) => {
      calls.push({ domain, service, data });
      return Promise.resolve({});
    },
    { "switch.exhaust_fan": { state: "on", attributes: {} } },
  );

  const panel = new Panel();
  panel.hass = hass;
  await flush();
  await flush();

  assert.ok(
    panel.shadowRoot.innerHTML.includes('data-action="toggle-device"'),
    "device cards carry the toggle action",
  );
  assert.ok(
    panel.shadowRoot.innerHTML.includes('data-entity-id="switch.exhaust_fan"'),
    "device cards carry their entity id",
  );

  panel._handleClick({
    target: fakeCardTarget("switch.exhaust_fan"),
    preventDefault() {},
    stopPropagation() {},
  });
  await flush();
  await flush();

  // The panel also fires its get_diary_content discovery on hass updates —
  // only the device toggle call is asserted here. Compared via JSON because
  // the call args are created inside the panel's vm realm (different Object
  // prototype), which deepStrictEqual would reject.
  const toggleCalls = calls.filter((c) => c.domain !== "growhelper");
  assert.equal(
    JSON.stringify(toggleCalls),
    JSON.stringify([
      { domain: "switch", service: "turn_off", data: { entity_id: "switch.exhaust_fan" } },
    ]),
  );
});

test("an 'off' device is turned on via its own domain", async () => {
  const Panel = loadPanelClass();
  const calls = [];
  const hass = makeDeviceHass(
    (domain, service, data) => {
      calls.push({ domain, service, data });
      return Promise.resolve({});
    },
    { "light.grow_light": { state: "off", attributes: {} } },
  );
  // grow_light role points at the light entity here
  hass.states["sensor.growhelper_config"].attributes.grow_light = "light.grow_light";

  const panel = new Panel();
  panel.hass = hass;
  await flush();
  await flush();

  panel._handleButtonAction("toggle-device", fakeCardTarget("light.grow_light"));
  await flush();
  await flush();

  const toggleCalls = calls.filter((c) => c.domain !== "growhelper");
  assert.equal(
    JSON.stringify(toggleCalls),
    JSON.stringify([
      { domain: "light", service: "turn_on", data: { entity_id: "light.grow_light" } },
    ]),
  );
});

test("a failed toggle renders the error banner with the service error", async () => {
  const Panel = loadPanelClass();
  const hass = makeDeviceHass(
    () => Promise.reject({ message: "not authorized" }),
    { "switch.humidifier": { state: "off", attributes: {} } },
  );

  const panel = new Panel();
  panel.hass = hass;
  await flush();
  await flush();

  panel._handleButtonAction("toggle-device", fakeCardTarget("switch.humidifier"));
  await flush();
  await flush();

  assert.ok(
    panel._errorMessage.includes("not authorized"),
    `error message should contain the service error, got: ${panel._errorMessage}`,
  );
  assert.ok(
    panel.shadowRoot.innerHTML.includes("error-banner"),
    "the error banner is rendered in the panel",
  );
});

// --- Growth Phase selector (issue #29): admin-only, via set_growth_phase ---

// hass mock for the phase selector: admin flag plus one phase helper on.
function makePhaseHass(callService, isAdmin) {
  const hass = makeDeviceHass(callService, {
    "input_boolean.growth_phase_early_veg": { state: "on", attributes: {} },
  });
  hass.states["sensor.growhelper_config"].attributes.growth_phase_early_veg =
    "input_boolean.growth_phase_early_veg";
  hass.user = { is_admin: isAdmin };
  return hass;
}

// Minimal fake <select> target as the change delegation would see it.
function fakePhaseSelect(value) {
  return {
    value,
    classList: { contains: () => false },
    getAttribute: (name) => (name === "data-action" ? "set-phase" : null),
  };
}

test("an admin sees the phase selector, a non-admin only the read-only label", async () => {
  const Panel = loadPanelClass();

  const adminPanel = new Panel();
  adminPanel.hass = makePhaseHass(() => Promise.resolve({}), true);
  await flush();
  await flush();
  assert.ok(
    adminPanel.shadowRoot.innerHTML.includes('data-action="set-phase"'),
    "admin gets the phase selector",
  );
  assert.ok(
    adminPanel.shadowRoot.innerHTML.includes('value="early-veg" selected'),
    "the active phase is preselected",
  );

  const userPanel = new Panel();
  userPanel.hass = makePhaseHass(() => Promise.resolve({}), false);
  await flush();
  await flush();
  assert.ok(
    !userPanel.shadowRoot.innerHTML.includes('data-action="set-phase"'),
    "non-admin gets no selector (set_growth_phase stays admin-only, issue #29)",
  );
  assert.ok(
    userPanel.shadowRoot.innerHTML.includes("Frühe Vegetationsphase"),
    "non-admin still sees the current phase label",
  );
});

test("changing the phase selector calls growhelper.set_growth_phase", async () => {
  const Panel = loadPanelClass();
  const calls = [];
  const hass = makePhaseHass((domain, service, data) => {
    calls.push({ domain, service, data });
    return Promise.resolve({});
  }, true);

  const panel = new Panel();
  panel.hass = hass;
  await flush();
  await flush();

  panel._handleFormChange({ target: fakePhaseSelect("dry") });
  await flush();
  await flush();

  const phaseCalls = calls.filter((c) => c.service === "set_growth_phase");
  assert.equal(
    JSON.stringify(phaseCalls),
    JSON.stringify([
      { domain: "growhelper", service: "set_growth_phase", data: { phase: "dry" } },
    ]),
  );
});

test("a failed phase change renders the error banner", async () => {
  const Panel = loadPanelClass();
  const hass = makePhaseHass(
    (domain, service) =>
      service === "set_growth_phase"
        ? Promise.reject({ message: "not authorized" })
        : Promise.resolve({}),
    true,
  );

  const panel = new Panel();
  panel.hass = hass;
  await flush();
  await flush();

  panel._setGrowthPhase("late-bloom");
  await flush();
  await flush();

  assert.ok(
    panel._errorMessage.includes("not authorized"),
    `error message should contain the service error, got: ${panel._errorMessage}`,
  );
  assert.ok(panel.shadowRoot.innerHTML.includes("error-banner"));
});

// --- Quick diary entry per Plant card (issue #31) ---

test("quick-entry on a plant card opens the diary form with the plant tag prefilled", async () => {
  const Panel = loadPanelClass();
  const hass = makeDeviceHass((domain, service) => {
    if (service === "get_diary_content") {
      return Promise.resolve({
        response: { run_name: "grow_run_20261106", content: "## 06.11.2026\n" },
      });
    }
    return Promise.resolve({});
  }, {});
  hass.states["sensor.growhelper_config"].attributes.plant_1_name = "Plant 1";
  hass.states["sensor.growhelper_config"].attributes.plant_1_cultivar = "Banana Boogie Split";

  const panel = new Panel();
  panel.hass = hass;
  await flush();
  await flush();

  assert.ok(
    panel.shadowRoot.innerHTML.includes('data-action="quick-entry"'),
    "plant cards carry the quick-entry action",
  );
  assert.ok(
    panel.shadowRoot.innerHTML.includes('data-plant-tag="Plant 1"'),
    "the quick-entry button carries its plant tag",
  );

  panel._handleButtonAction("quick-entry", {
    classList: { contains: () => false },
    getAttribute: (name) =>
      name === "data-action" ? "quick-entry" : name === "data-plant-tag" ? "Plant 1" : null,
    parentElement: null,
  });
  await flush();
  await flush();

  assert.equal(panel._showEntryForm, true, "the entry form is opened");
  assert.equal(
    panel._entryFormData.plant_tag,
    "Plant 1",
    "the plant tag is prefilled (issue #31)",
  );
  assert.ok(
    panel.shadowRoot.innerHTML.includes('data-action="submit-entry"'),
    "the entry form is rendered",
  );
});
