"""Tests for Growhelper setup and the sidebar panel."""

from homeassistant.components.frontend import DATA_PANELS
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.growhelper.const import DOMAIN


async def test_setup_and_unload_config_entry(hass: HomeAssistant) -> None:
    """A config entry sets up and unloads cleanly."""
    entry = MockConfigEntry(domain=DOMAIN, data={}, title="Meine Grow Box")
    entry.add_to_hass(hass)

    await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.LOADED

    await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.NOT_LOADED


async def test_sidebar_panel_is_registered(hass: HomeAssistant) -> None:
    """Setup registers the Growhelper panel in the Home Assistant sidebar."""
    entry = MockConfigEntry(domain=DOMAIN, data={}, title="Meine Grow Box")
    entry.add_to_hass(hass)
    await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    panel = hass.data[DATA_PANELS]["growhelper"]
    assert panel.component_name == "custom"
    assert panel.sidebar_title == "Growhelper"
    assert panel.sidebar_icon == "mdi:cannabis"
    assert panel.config is not None
    panel_custom = panel.config["_panel_custom"]
    assert panel_custom["name"] == "growhelper-panel"
    assert panel_custom["module_url"] == "/growhelper_static/growhelper-panel.js"


async def test_panel_webcomponent_is_served(hass: HomeAssistant, hass_client) -> None:
    """The panel's web component is served with all section headings and empty states."""
    entry = MockConfigEntry(domain=DOMAIN, data={}, title="Meine Grow Box")
    entry.add_to_hass(hass)
    await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    client = await hass_client()
    response = await client.get("/growhelper_static/growhelper-panel.js")
    assert response.status == 200

    # The panel renders all Grow Box sections (Issues #8, #9, #10):
    # camera, environment, VPD, climate devices, light, plants, diary.
    body = await response.text()
    for heading in (
        "Kamera",
        "Umgebung",
        "VPD (Dampfdruckdefizit)",
        "Klima-Geräte",
        "Licht-Steuerung",
        "Pflanzen",
        "Tagebuch",
    ):
        assert heading in body
    # Empty states are shown when no entities are configured
    assert "Keine Kamera konfiguriert" in body
    assert "customElements.define(" in body
    assert any(
        f"{quote}growhelper-panel{quote}" in body for quote in ("'", '"')
    )
