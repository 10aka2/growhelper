/**
 * Rendered-content check for the served Growhelper panel bundle (issue #13).
 *
 * Loads the served bundle in a minimal DOM mock, feeds it the live states of
 * the E2E Home Assistant instance, and asserts that the rendered markup
 * contains the configured values and German labels — and no un-evaluated
 * template fragments (raw `' + … + '` source text).
 *
 * Usage: node tests/e2e/render-check.mjs <panel-bundle.js> <fixture.json>
 * The fixture is `{"states": {<entity_id>: {state, attributes}}}` — exactly
 * what GET /api/states returns.
 *
 * Exits 0 when the panel renders correctly, 1 with a diagnostic otherwise.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const [bundlePath, fixturePath] = process.argv.slice(2);
assert.ok(bundlePath, "usage: node render-check.mjs <bundle> <fixture.json>");
assert.ok(fixturePath, "usage: node render-check.mjs <bundle> <fixture.json>");

const source = readFileSync(bundlePath, "utf8");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));

// --- Minimal DOM mocks (the bundle is a web component) ---
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

const Panel = sandbox.__panelClass;
assert.ok(Panel, "the bundle did not register a custom element");

const hass = {
  states: fixture.states,
  // Return a resolved empty response so the panel's service calls settle.
  callService: () => Promise.resolve({}),
};
const panel = new Panel();
panel.hass = hass;
const html = panel.shadowRoot.innerHTML;
const text = html
  .replace(/<style>[\s\S]*?<\/style>/, "")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const failures = [];

// 1. No un-evaluated template fragments may leak into the rendered markup.
if (/' \+ |\+ '|\$\{/.test(html)) {
  failures.push("rendered markup contains raw template fragments (' + … + ' or ${…})");
}

// 2. Live values of the configured Entity Roles must render.
const config = Object.values(fixture.states).find(
  (s) => s.attributes && Object.keys(s.attributes).length > 0 &&
    typeof s.attributes.canopy_temperature === "string",
)?.attributes;
assert.ok(config, "fixture has no sensor.growhelper_config state with attributes");
const roleValue = (role) => fixture.states[config[role]]?.state;
for (const [role, decimals] of [
  ["canopy_temperature", 1],
  ["canopy_humidity", 1],
  ["vpd_sensor", 2],
]) {
  const raw = roleValue(role);
  if (raw === undefined) continue;
  const num = Number.parseFloat(raw);
  if (Number.isNaN(num)) continue;
  const rendered = num.toFixed(decimals);
  if (!text.includes(rendered)) {
    failures.push(`configured ${role} value ${raw} (rendered as ${rendered}) is missing from the panel`);
  }
}

// 3. The growth phase indicator shows the German label, never the raw key.
const phaseKeys = ["early-veg", "late-veg", "late-bloom", "dry", "off"];
let activePhase = "off";
for (const phase of phaseKeys) {
  const entityId = config["growth_phase_" + phase.replace(/-/g, "_")];
  if (entityId && fixture.states[entityId]?.state === "on") {
    activePhase = phase;
    break;
  }
}
const germanLabels = {
  "early-veg": "Frühe Vegetationsphase",
  "late-veg": "Späte Vegetationsphase",
  "late-bloom": "Späte Blüte",
  dry: "Trocknung",
  off: "Aus",
};
const phaseMatch = html.match(/class="growth-phase"[\s\S]*?<\/span>\s*<span>([^<]*)<\/span>/);
if (!phaseMatch || phaseMatch[1] !== germanLabels[activePhase]) {
  failures.push(
    `growth phase indicator shows ${JSON.stringify(phaseMatch?.[1])}, expected ${JSON.stringify(germanLabels[activePhase])}`,
  );
}

// 4. VPD reference zone labels are German.
for (const label of ["Unter-Transpiration", "Gefahrenzone", germanLabels["early-veg"], germanLabels["late-veg"]]) {
  if (!html.includes(label)) failures.push(`VPD zone label ${JSON.stringify(label)} missing`);
}
for (const english of ["Early Veg", "Late Veg", "Mid-Late Flower"]) {
  if (html.includes(english)) failures.push(`English VPD zone label ${JSON.stringify(english)} leaked`);
}

if (failures.length > 0) {
  console.error("panel render check FAILED:");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
}
console.log(`panel render check passed (phase: ${germanLabels[activePhase]})`);
