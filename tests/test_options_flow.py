"""Tests for the Growhelper options flow."""

from collections.abc import Callable
from typing import Any, cast

import pytest
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType, InvalidData
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.growhelper.const import DOMAIN, ENTITY_ROLES

# A complete set of Entity Role values, mirroring a real Grow Box setup.
OPTIONS_INPUT = {
    "canopy_temperature": "sensor.growbox_canopy_temperature",
    "canopy_humidity": "sensor.growbox_canopy_humidity",
    "vpd_sensor": "sensor.growbox_vpd",
    "camera": "camera.growbox",
    "humidifier": "switch.growbox_humidifier",
    "dehumidifier": "switch.growbox_dehumidifier",
    "exhaust_fan": "switch.growbox_exhaust_fan",
    "ventilation_fan": "switch.growbox_ventilation_fan",
    "grow_light": "switch.growbox_grow_light",
    "humidifier_power": "sensor.growbox_humidifier_power",
    "dehumidifier_power": "sensor.growbox_dehumidifier_power",
    "exhaust_fan_power": "sensor.growbox_exhaust_fan_power",
    "ventilation_fan_power": "sensor.growbox_ventilation_fan_power",
    "grow_light_power": "sensor.growbox_grow_light_power",
    "growth_phase_early_veg": "input_boolean.growbox_early_veg",
    "growth_phase_late_veg": "input_boolean.growbox_late_veg",
    "growth_phase_late_bloom": "input_boolean.growbox_late_bloom",
    "growth_phase_dry": "input_boolean.growbox_dry",
    "growth_phase_off": "input_boolean.growbox_off",
    "temperature_lower_threshold": "input_number.growbox_temperature_lower",
    "temperature_upper_threshold": "input_number.growbox_temperature_upper",
    "humidity_lower_threshold": "input_number.growbox_humidity_lower",
    "humidity_upper_threshold": "input_number.growbox_humidity_upper",
    "vpd_lower_threshold": "input_number.growbox_vpd_lower",
    "vpd_upper_threshold": "input_number.growbox_vpd_upper",
    "light_on_time": "input_datetime.growbox_light_on",
    "light_off_time": "input_datetime.growbox_light_off",
    "camera_rotation": "90",
}


async def _setup_entry(hass: HomeAssistant) -> MockConfigEntry:
    """Set up a Growhelper config entry and return it."""
    entry = MockConfigEntry(domain=DOMAIN, data={}, title="Meine Grow Box")
    entry.add_to_hass(hass)
    await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.LOADED
    return entry


async def test_options_flow_shows_all_entity_role_pickers(
    hass: HomeAssistant,
) -> None:
    """The options form shows a picker for every Entity Role plus the rotation."""
    entry = await _setup_entry(hass)

    result = await hass.config_entries.options.async_init(entry.entry_id)

    assert result["type"] is FlowResultType.FORM
    data_schema = result["data_schema"]
    assert data_schema is not None
    schema_keys = {marker.schema for marker in data_schema.schema}
    assert schema_keys == set(ENTITY_ROLES) | {"camera_rotation"}


async def test_options_flow_stores_entity_roles_and_rotation(
    hass: HomeAssistant,
) -> None:
    """Submitting the options flow stores the Entity Roles and the rotation."""
    entry = await _setup_entry(hass)

    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], OPTIONS_INPUT
    )

    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert dict(entry.options) == OPTIONS_INPUT


async def test_options_flow_round_trips(hass: HomeAssistant) -> None:
    """Reopening the options flow shows the stored values."""
    entry = await _setup_entry(hass)

    result = await hass.config_entries.options.async_init(entry.entry_id)
    await hass.config_entries.options.async_configure(result["flow_id"], OPTIONS_INPUT)
    await hass.async_block_till_done()

    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["type"] is FlowResultType.FORM
    data_schema = result["data_schema"]
    assert data_schema is not None
    suggested = {
        marker.schema: (marker.description or {}).get("suggested_value")
        for marker in data_schema.schema
    }
    for key, value in OPTIONS_INPUT.items():
        if key == "camera_rotation":
            continue  # the rotation selector pre-fills via its default
        assert suggested[key] == value
    rotation_marker = next(
        marker for marker in data_schema.schema if marker.schema == "camera_rotation"
    )
    # voluptuous stores defaults as zero-argument factories.
    rotation_default = cast(Callable[[], Any], rotation_marker.default)
    assert rotation_default() == "90"


async def test_options_flow_rejects_missing_required_roles(
    hass: HomeAssistant,
) -> None:
    """Submitting without the required roles is rejected with a clear error."""
    entry = await _setup_entry(hass)
    required_roles = {
        role for role, (_, required) in ENTITY_ROLES.items() if required
    }
    optional_roles = set(ENTITY_ROLES) - required_roles

    result = await hass.config_entries.options.async_init(entry.entry_id)
    with pytest.raises(InvalidData) as excinfo:
        await hass.config_entries.options.async_configure(result["flow_id"], {})

    # Every missing required role is reported; optional roles are not.
    assert required_roles <= set(excinfo.value.schema_errors)
    assert not optional_roles & set(excinfo.value.schema_errors)
    assert not entry.options


async def test_options_flow_allows_optional_power_sensors_to_be_empty(
    hass: HomeAssistant,
) -> None:
    """The optional power sensor roles can be left unconfigured."""
    entry = await _setup_entry(hass)
    required_only = {
        key: value
        for key, value in OPTIONS_INPUT.items()
        if key != "camera_rotation" and not key.endswith("_power")
    }

    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], required_only
    )

    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert dict(entry.options) == required_only | {"camera_rotation": "0"}
