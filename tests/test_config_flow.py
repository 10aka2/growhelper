"""Tests for the Growhelper config flow."""

from homeassistant.config_entries import SOURCE_USER
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType

from custom_components.growhelper.const import DOMAIN


async def test_user_flow_creates_config_entry(hass: HomeAssistant) -> None:
    """The user step creates a config entry titled with the Grow Box name."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": SOURCE_USER}
    )
    assert result["type"] is FlowResultType.FORM
    assert result["step_id"] == "user"

    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"name": "Meine Grow Box"}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["title"] == "Meine Grow Box"
    assert result["data"] == {}
