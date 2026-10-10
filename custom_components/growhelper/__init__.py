"""The Growhelper integration: a management panel for a Grow Box.

v1 is a thin management layer. The control loop (automations, VPD alarm, PID)
stays in Home Assistant; the panel is a thin client that calls `growhelper.*`
services. The set_growth_phase service writes the user's existing input helpers
(ADR-0002) so the existing automations keep working untouched.
"""

from __future__ import annotations

from pathlib import Path

from homeassistant.components.http import StaticPathConfig
from homeassistant.components.panel_custom import async_register_panel
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import DOMAIN
from . import services

PANEL_FRONTEND_URL_PATH = "growhelper"
PANEL_WEBCOMPONENT_NAME = "growhelper-panel"
PANEL_STATIC_URL_PATH = "/growhelper_static"
PANEL_MODULE_URL = f"{PANEL_STATIC_URL_PATH}/growhelper-panel.js"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Growhelper from a config entry: serve, register the panel and services."""
    # Set up the services for this config entry
    await services.async_setup_services(hass, entry)
    
    # Serve the panel's web component so the frontend can load it from the
    # module URL registered below.
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                url_path=PANEL_STATIC_URL_PATH,
                path=str(Path(__file__).parent / "www"),
                cache_headers=False,
            )
        ]
    )
    # The frontend loads the panel's web component from the module URL and
    # creates the registered element. The panel renders the section skeleton
    # of the user's existing dashboard; later tickets fill the sections.
    try:
        await async_register_panel(
            hass,
            frontend_url_path=PANEL_FRONTEND_URL_PATH,
            webcomponent_name=PANEL_WEBCOMPONENT_NAME,
            sidebar_title="Growhelper",
            sidebar_icon="mdi:cannabis",
            module_url=PANEL_MODULE_URL,
        )
    except ValueError as e:
        # Panel already registered (e.g., during reload)
        # This is expected and safe to ignore
        if "Overwriting panel" in str(e):
            pass
        else:
            raise
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a Growhelper config entry."""
    return True
