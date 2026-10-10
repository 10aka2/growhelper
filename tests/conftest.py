"""Shared fixtures for the Growhelper tests.

The single test seam is a real, in-process Home Assistant instance provided by
pytest-homeassistant-custom-component. Every test drives the integration
through Home Assistant's public surface (config flows, config entries, HTTP)
and never reaches into integration internals.
"""

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component

pytest_plugins = "pytest_homeassistant_custom_component"


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    """Enable loading custom integrations in every test."""
    yield


@pytest.fixture(autouse=True)
async def setup_http_component(hass: HomeAssistant) -> None:
    """Set up the HTTP component; integration setup registers static paths on it."""
    assert await async_setup_component(hass, "http", {})
