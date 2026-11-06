/**
 * Panel state regression tests (issue #18), runnable without a browser:
 * loads the committed served bundle in a minimal DOM mock and drives the
 * panel with a mocked hass object.
 *
 * Covers:
 * - the active Grow Run is discovered from the backend (get_diary_content)
 *   and survives subsequent hass updates (no more state wipe)
 * - a failed start_grow_run renders a visible error banner
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

// The placeholder config state carries no active_grow_run — exactly what the
// integration's sensor.growhelper_config placeholder provides in production.
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
