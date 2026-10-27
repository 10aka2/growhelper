/**
 * Check that the real Growhelper web component renders configured values,
 * rather than exposing the JavaScript fragments used to build its markup.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";

const baseUrl = process.env.HA_BASE_URL ?? "http://127.0.0.1:8123";
const username = process.env.HA_USERNAME ?? "growhelper-e2e";
const password = process.env.HA_PASSWORD ?? "growhelper-e2e";

test("Growhelper panel renders live values and German labels", async () => {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

    const usernameInput = page.locator('input[name="username"]');
    const sidebar = page.locator("ha-sidebar");
    const authState = await Promise.race([
      usernameInput
        .waitFor({ state: "visible", timeout: 20_000 })
        .then(() => "login", () => null),
      sidebar
        .waitFor({ state: "attached", timeout: 20_000 })
        .then(() => "ready", () => null),
    ]);

    assert.notEqual(authState, null, "Home Assistant did not finish loading");
    if (authState === "login") {
      await usernameInput.fill(username);
      const passwordInput = page.locator('input[name="password"]');
      await passwordInput.fill(password);
      await passwordInput.press("Enter");
      await page.waitForURL((url) => url.pathname.startsWith("/home/"), {
        timeout: 20_000,
      });
    }

    const panelLink = page.locator('a[href$="/growhelper"]');
    await panelLink.waitFor({ state: "visible", timeout: 30_000 });
    await panelLink.click();

    const panel = page.locator("growhelper-panel");
    await panel.waitFor({ state: "attached", timeout: 30_000 });

    const initialText = await panel.evaluate((element) => element.shadowRoot.textContent);
    assert.doesNotMatch(
      initialText,
      /' \+ | \+ '/,
      "the live panel must not expose template-concatenation fragments",
    );

    const rendered = await panel.evaluate((element) => {
      element._config = {
        canopy_temperature: "sensor.canopy_temperature",
        canopy_humidity: "sensor.canopy_humidity",
        vpd_sensor: "sensor.vpd",
        growth_phase_early_veg: "input_boolean.growth_phase_early_veg",
        humidifier: "switch.humidifier",
        humidifier_power: "sensor.humidifier_power",
        grow_light: "switch.grow_light",
        grow_light_power: "sensor.grow_light_power",
        "early-veg_light_on_time": "06:30",
        "early-veg_light_off_time": "18:30",
        plant_1_name: "Blue Dream",
        plant_1_cultivar: "Berry Haze",
        plant_1_soil_temperature: "sensor.soil_temperature",
        active_grow_run: "grow_run_20261027",
      };
      element._entityStates = {
        "sensor.canopy_temperature": { state: "24.5", attributes: {} },
        "sensor.canopy_humidity": { state: "55", attributes: {} },
        "sensor.vpd": { state: "1.1", attributes: {} },
        "switch.humidifier": { state: "on", attributes: {} },
        "sensor.humidifier_power": { state: "115", attributes: {} },
        "switch.grow_light": { state: "on", attributes: {} },
        "sensor.grow_light_power": { state: "320", attributes: {} },
        "sensor.soil_temperature": { state: "21.5", attributes: {} },
        "input_boolean.growth_phase_early_veg": {
          state: "on",
          attributes: {},
        },
      };
      element._growthPhase = "early-veg";
      element._loadTargetProfile();
      element._loadPlants();
      element._loadActiveGrowRun();
      element._loadDiaryContent();
      element._render();

      const root = element.shadowRoot;
      return {
        text: root.textContent,
        growthPhase: root
          .querySelector(".growth-phase")
          ?.textContent.replace(/\s+/g, " ")
          .trim(),
        temperature: root
          .querySelector('[data-section="environment"] .value')
          ?.textContent.replace(/\s+/g, " ")
          .trim(),
        humidity: root
          .querySelector('[data-section="environment"] .env-card:nth-child(2) .value')
          ?.textContent.replace(/\s+/g, " ")
          .trim(),
        climateState: root
          .querySelector('[data-section="climate"] .device-state')
          ?.textContent.trim(),
        climatePower: root
          .querySelector('[data-section="climate"] .device-power')
          ?.textContent.trim(),
        lightSection: root.querySelector('[data-section="light"] .card')?.textContent,
        plant: root.querySelector('[data-section="plants"] .plant-name')?.textContent.trim(),
        soilTemperature: root
          .querySelector('[data-section="plants"] .plant-sensor-card.has-value .sensor-value')
          ?.textContent.replace(/\s+/g, " ")
          .trim(),
        diary: root.querySelector('[data-section="diary"] .card')?.textContent,
        vpdZones: Array.from(root.querySelectorAll(".vpd-zone-label"), (label) =>
          label.textContent.trim(),
        ),
      };
    });

    assert.doesNotMatch(
      rendered.text,
      /this\._growthPhase|hasCamera \?|this\._formatNumber\(currentValues/,
      "the panel must not render JavaScript source fragments as text",
    );
    assert.equal(rendered.growthPhase, "🌱 Frühe Vegetationsphase");
    assert.equal(rendered.temperature, "24.5 °C");
    assert.equal(rendered.humidity, "55.0 %");
    assert.equal(rendered.climateState, "EIN");
    assert.equal(rendered.climatePower, "115 W");
    assert.match(rendered.lightSection, /06:30.*18:30.*EINGESCHALTET.*Leistung: 320 W/s);
    assert.equal(rendered.plant, "Blue Dream");
    assert.equal(rendered.soilTemperature, "21.5 °C");
    assert.match(rendered.diary, /grow_run_20261027.*Pflanzen bewässert/s);
    assert.deepEqual(rendered.vpdZones, [
      "Unter-Transpiration",
      "Frühe Vegetationsphase",
      "Späte Vegetationsphase",
      "Mittlere bis späte Blüte",
      "Gefahrenzone",
    ]);
  } finally {
    await browser.close();
  }
});