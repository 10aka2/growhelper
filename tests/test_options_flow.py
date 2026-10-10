"""Tests for the Growhelper options flow."""

from collections.abc import Callable
from typing import Any, cast

import pytest
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType, InvalidData
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.growhelper.const import (
    DOMAIN,
    ENTITY_ROLES,
    GROWTH_PHASES,
    TARGET_PROFILE_FIELDS,
)

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

# A complete set of Target Profile values for all Growth Phases.
TARGET_PROFILES_INPUT = {
    # early-veg
    "early-veg_temperature_lower": 20.0,
    "early-veg_temperature_upper": 28.0,
    "early-veg_humidity_lower": 60.0,
    "early-veg_humidity_upper": 80.0,
    "early-veg_vpd_lower": 0.4,
    "early-veg_vpd_upper": 0.8,
    "early-veg_light_on_time": "08:00",
    "early-veg_light_off_time": "20:00",
    # late-veg
    "late-veg_temperature_lower": 22.0,
    "late-veg_temperature_upper": 30.0,
    "late-veg_humidity_lower": 50.0,
    "late-veg_humidity_upper": 70.0,
    "late-veg_vpd_lower": 0.8,
    "late-veg_vpd_upper": 1.2,
    "late-veg_light_on_time": "08:00",
    "late-veg_light_off_time": "20:00",
    # late-bloom
    "late-bloom_temperature_lower": 20.0,
    "late-bloom_temperature_upper": 28.0,
    "late-bloom_humidity_lower": 40.0,
    "late-bloom_humidity_upper": 60.0,
    "late-bloom_vpd_lower": 1.2,
    "late-bloom_vpd_upper": 1.6,
    "late-bloom_light_on_time": "08:00",
    "late-bloom_light_off_time": "20:00",
    # dry
    "dry_temperature_lower": 18.0,
    "dry_temperature_upper": 24.0,
    "dry_humidity_lower": 45.0,
    "dry_humidity_upper": 55.0,
    "dry_vpd_lower": 1.0,
    "dry_vpd_upper": 1.4,
    "dry_light_on_time": "12:00",
    "dry_light_off_time": "12:00",
    # off
    "off_temperature_lower": 15.0,
    "off_temperature_upper": 25.0,
    "off_humidity_lower": 40.0,
    "off_humidity_upper": 60.0,
    "off_vpd_lower": 0.2,
    "off_vpd_upper": 0.6,
    "off_light_on_time": "00:00",
    "off_light_off_time": "00:00",
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

    # The schema now includes Entity Roles, camera_rotation, and Target Profile fields
    expected_entity_keys = set(ENTITY_ROLES) | {"camera_rotation"}
    expected_target_keys = {
        f"{phase}_{field}" for phase in GROWTH_PHASES for field in TARGET_PROFILE_FIELDS
    }
    assert expected_entity_keys.issubset(schema_keys)
    assert expected_target_keys.issubset(schema_keys)


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
    # Check that all Entity Role fields are stored
    for key, value in OPTIONS_INPUT.items():
        assert entry.options.get(key) == value


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
    # Check that required Entity Roles are stored
    for key, value in required_only.items():
        assert entry.options.get(key) == value
    # Check that camera_rotation has default value
    assert entry.options.get("camera_rotation") == "0"


# Target Profile tests


async def test_options_flow_shows_all_target_profile_fields(
    hass: HomeAssistant,
) -> None:
    """The options form shows all Target Profile fields for all Growth Phases."""
    entry = await _setup_entry(hass)

    result = await hass.config_entries.options.async_init(entry.entry_id)

    assert result["type"] is FlowResultType.FORM
    data_schema = result["data_schema"]
    assert data_schema is not None

    # Check that all Target Profile fields are present
    schema_keys = {marker.schema for marker in data_schema.schema}
    expected_keys = {
        f"{phase}_{field}" for phase in GROWTH_PHASES for field in TARGET_PROFILE_FIELDS
    }
    assert expected_keys.issubset(schema_keys)


async def test_options_flow_stores_target_profiles(
    hass: HomeAssistant,
) -> None:
    """Submitting the options flow stores all Target Profiles."""
    entry = await _setup_entry(hass)

    # Combine Entity Roles and Target Profiles
    combined_input = OPTIONS_INPUT | TARGET_PROFILES_INPUT

    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], combined_input
    )

    assert result["type"] is FlowResultType.CREATE_ENTRY
    # Check that all Target Profile fields are stored
    for key, value in TARGET_PROFILES_INPUT.items():
        assert entry.options.get(key) == value


async def test_options_flow_target_profiles_round_trip(
    hass: HomeAssistant,
) -> None:
    """Reopening the options flow shows the stored Target Profile values."""
    entry = await _setup_entry(hass)

    # Combine Entity Roles and Target Profiles
    combined_input = OPTIONS_INPUT | TARGET_PROFILES_INPUT

    result = await hass.config_entries.options.async_init(entry.entry_id)
    await hass.config_entries.options.async_configure(
        result["flow_id"], combined_input
    )
    await hass.async_block_till_done()

    # Reopen and check defaults
    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["type"] is FlowResultType.FORM
    data_schema = result["data_schema"]
    assert data_schema is not None

    # Check that defaults match stored values for Target Profiles
    for marker in data_schema.schema:
        if marker.schema in TARGET_PROFILES_INPUT:
            suggested = (marker.description or {}).get("suggested_value")
            if suggested is not None:
                assert suggested == TARGET_PROFILES_INPUT[marker.schema]


async def test_options_flow_rejects_invalid_temperature_range(
    hass: HomeAssistant,
) -> None:
    """Submitting with temperature lower >= upper shows an error form."""
    entry = await _setup_entry(hass)

    # Create invalid input with temperature lower >= upper for early-veg
    invalid_input = OPTIONS_INPUT | dict(TARGET_PROFILES_INPUT)
    invalid_input["early-veg_temperature_lower"] = 30.0
    invalid_input["early-veg_temperature_upper"] = 20.0

    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], invalid_input
    )

    # Should return a form with errors instead of creating the entry
    assert result["type"] is FlowResultType.FORM
    assert "errors" in result
    assert "early-veg_temperature_lower" in result["errors"]
    assert "early-veg_temperature_upper" in result["errors"]


async def test_options_flow_rejects_invalid_humidity_range(
    hass: HomeAssistant,
) -> None:
    """Submitting with humidity lower >= upper shows an error form."""
    entry = await _setup_entry(hass)

    # Create invalid input with humidity lower >= upper for late-veg
    invalid_input = OPTIONS_INPUT | dict(TARGET_PROFILES_INPUT)
    invalid_input["late-veg_humidity_lower"] = 70.0
    invalid_input["late-veg_humidity_upper"] = 50.0

    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], invalid_input
    )

    # Should return a form with errors instead of creating the entry
    assert result["type"] is FlowResultType.FORM
    assert "errors" in result
    assert "late-veg_humidity_lower" in result["errors"]
    assert "late-veg_humidity_upper" in result["errors"]


async def test_options_flow_rejects_invalid_vpd_range(
    hass: HomeAssistant,
) -> None:
    """Submitting with VPD lower >= upper shows an error form."""
    entry = await _setup_entry(hass)

    # Create invalid input with VPD lower >= upper for late-bloom
    invalid_input = OPTIONS_INPUT | dict(TARGET_PROFILES_INPUT)
    invalid_input["late-bloom_vpd_lower"] = 1.6
    invalid_input["late-bloom_vpd_upper"] = 1.2

    result = await hass.config_entries.options.async_init(entry.entry_id)
    result = await hass.config_entries.options.async_configure(
        result["flow_id"], invalid_input
    )

    # Should return a form with errors instead of creating the entry
    assert result["type"] is FlowResultType.FORM
    assert "errors" in result
    assert "late-bloom_vpd_lower" in result["errors"]
    assert "late-bloom_vpd_upper" in result["errors"]
