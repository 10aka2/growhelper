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
    page.on("console", (message) => {
      if (message.type() === "error") {
        console.log(`[browser console] ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      console.log(`[browser page error] ${error.message}`);
    });
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
    const panelElement = await panel.elementHandle();
    assert.ok(panelElement, "the Growhelper panel element is not available");

    await page.waitForFunction((element) => {
      const root = element.shadowRoot;
      return root?.querySelector("h1")?.textContent === "Growhelper";
    }, panelElement, { timeout: 15_000 });

    try {
      await page.waitForFunction((element) => {
        const root = element.shadowRoot;
        return root
          ?.querySelector('[data-section="diary"] .card')
          ?.textContent.includes("E2E smoke test entry");
      }, panelElement, { timeout: 15_000 });
    } catch (error) {
      const observedValues = await panel.evaluate((element) => {
        const root = element.shadowRoot;
        const text = (selector) => root.querySelector(selector)?.textContent.trim();
        return {
          growthPhase: text(".growth-phase"),
          temperature: text('[data-section="environment"] .env-card:nth-child(1) .value'),
          humidity: text('[data-section="environment"] .env-card:nth-child(2) .value'),
          vpd: text('[data-section="vpd"] .vpd-value'),
          lightSchedule: text('[data-section="light"] .light-schedule'),
          plant: text('[data-section="plants"] .plant-name'),
          diary: text('[data-section="diary"] .card'),
        };
      });
      throw new Error(`${error.message}; rendered panel values: ${JSON.stringify(observedValues)}`);
    }

    const rendered = await panel.evaluate((element) => {
      const root = element.shadowRoot;
      const text = (selector) => root.querySelector(selector)?.textContent.trim();
      return {
        text: root.textContent,
        growthPhase: root
          .querySelector(".growth-phase")
          ?.textContent.replace(/\s+/g, " ")
          .trim(),
        temperature: root
          .querySelector('[data-section="environment"] .env-card:nth-child(1) .value')
          ?.textContent.replace(/\s+/g, " ").trim(),
        humidity: root
          .querySelector('[data-section="environment"] .env-card:nth-child(2) .value')
          ?.textContent.replace(/\s+/g, " ").trim(),
        vpd: text('[data-section="vpd"] .vpd-value'),
        climateDevices: Array.from(
          root.querySelectorAll('[data-section="climate"] .device-card'),
          (card) => ({
            name: card.querySelector(".device-name")?.textContent.trim(),
            state: card.querySelector(".device-state")?.textContent.trim(),
            power: Number(card.querySelector(".device-power")?.textContent.replace(" W", "")),
          }),
        ),
        lightSection: text('[data-section="light"] .card'),
        plant: text('[data-section="plants"] .plant-name'),
        soilTemperature: root
          .querySelector('[data-section="plants"] .plant-sensor-card.has-value .sensor-value')
          ?.textContent.replace(/\s+/g, " ").trim(),
        diary: text('[data-section="diary"] .card'),
        vpdZones: Array.from(root.querySelectorAll(".vpd-zone-label"), (label) =>
          label.textContent.trim(),
        ),
      };
    });

    assert.doesNotMatch(
      rendered.text,
      /' \+ | \+ '|this\._growthPhase|hasCamera \?|this\._formatNumber\(currentValues/,
      "the panel must not render JavaScript source fragments as text",
    );
    assert.equal(rendered.growthPhase, "🌱 Frühe Vegetationsphase");
    assert.equal(rendered.temperature, "24.5 °C");
    assert.equal(rendered.humidity, "55.0 %");
    assert.equal(rendered.vpd, "1.10");
    assert.deepEqual(rendered.climateDevices, [
      { name: "Befeuchter", state: "AUS", power: 0 },
      { name: "Entfeuchter", state: "AUS", power: 0 },
      { name: "Abluft", state: "EIN", power: 45 },
      { name: "Belüftung", state: "EIN", power: 30 },
    ]);
    assert.match(rendered.lightSection, /06:30.*18:30.*EINGESCHALTET.*Leistung: 240(?:\.0)? W/s);
    assert.equal(rendered.plant, "Plant 1");
    assert.equal(rendered.soilTemperature, "22.0 °C");
    assert.match(
      rendered.diary,
      /e2e_smoke_run.*18\.10\.2026.*Smoke Test.*E2E smoke test entry/s,
    );
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