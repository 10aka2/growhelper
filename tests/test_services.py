"""Tests for the Growhelper services."""

import pytest
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.growhelper.const import (
    DOMAIN,
    GROWTH_PHASES,
    SERVICE_SET_GROWTH_PHASE,
)


# Test data for Entity Roles and Target Profiles
ENTITY_ROLES_OPTIONS = {
    "canopy_temperature": "sensor.growbox_canopy_temperature",
    "canopy_humidity": "sensor.growbox_canopy_humidity",
    "vpd_sensor": "sensor.growbox_vpd",
    "camera": "camera.growbox",
    "humidifier": "switch.growbox_humidifier",
    "dehumidifier": "switch.growbox_dehumidifier",
    "exhaust_fan": "switch.growbox_exhaust_fan",
    "ventilation_fan": "switch.growbox_ventilation_fan",
    "grow_light": "switch.growbox_grow_light",
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
    "camera_rotation": "0",
}

# Target Profile for early-veg
TARGET_PROFILE_EARLY_VEG = {
    "early-veg_temperature_lower": 20.0,
    "early-veg_temperature_upper": 28.0,
    "early-veg_humidity_lower": 60.0,
    "early-veg_humidity_upper": 80.0,
    "early-veg_vpd_lower": 0.4,
    "early-veg_vpd_upper": 0.8,
    "early-veg_light_on_time": "08:00",
    "early-veg_light_off_time": "20:00",
}

# Target Profile for late-veg
TARGET_PROFILE_LATE_VEG = {
    "late-veg_temperature_lower": 22.0,
    "late-veg_temperature_upper": 30.0,
    "late-veg_humidity_lower": 50.0,
    "late-veg_humidity_upper": 70.0,
    "late-veg_vpd_lower": 0.8,
    "late-veg_vpd_upper": 1.2,
    "late-veg_light_on_time": "08:00",
    "late-veg_light_off_time": "20:00",
}


async def _setup_entry_with_options(hass: HomeAssistant) -> MockConfigEntry:
    """Set up a Growhelper config entry with Entity Roles and Target Profiles."""
    entry = MockConfigEntry(
        domain=DOMAIN,
        data={},
        title="Meine Grow Box",
        options=ENTITY_ROLES_OPTIONS | TARGET_PROFILE_EARLY_VEG | TARGET_PROFILE_LATE_VEG,
    )
    entry.add_to_hass(hass)
    await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.LOADED
    return entry


async def test_set_growth_phase_service_is_registered(
    hass: HomeAssistant,
) -> None:
    """The set_growth_phase service is registered."""
    entry = await _setup_entry_with_options(hass)
    
    # Check that the service is registered under the growhelper domain
    services = hass.services.async_services()
    assert DOMAIN in services
    assert SERVICE_SET_GROWTH_PHASE in services[DOMAIN]


async def test_set_growth_phase_accepts_valid_phases(
    hass: HomeAssistant,
) -> None:
    """Calling set_growth_phase with valid phases does not raise an error."""
    entry = await _setup_entry_with_options(hass)
    
    # Call with each valid phase - should not raise
    for phase in GROWTH_PHASES:
        # This should not raise an error even though the entities don't exist
        # The service will attempt to call the input helper services
        await hass.services.async_call(
            DOMAIN,
            SERVICE_SET_GROWTH_PHASE,
            {"phase": phase},
        )
        await hass.async_block_till_done()


async def test_set_growth_phase_writes_phase_booleans_and_target_profile(
    hass: HomeAssistant,
) -> None:
    """set_growth_phase turns exactly the selected phase boolean on (ADR-0002).

    Regression test: the phase boolean Entity Role keys use underscores
    (growth_phase_early_veg) while the Growth Phase names use dashes
    (early-veg); the service must map between the two when reading the
    options. Also verifies the Target Profile values land in the helpers.
    """
    await _setup_entry_with_options(hass)

    # Create the writable input helpers the phase bridge writes. The config
    # keys must produce the entity ids the options map to.
    await async_setup_component(
        hass,
        "input_boolean",
        {
            "input_boolean": {
                f"growbox_{phase.replace('-', '_')}": {"name": phase}
                for phase in GROWTH_PHASES
            }
        },
    )
    await async_setup_component(
        hass,
        "input_number",
        {
            "input_number": {
                "growbox_temperature_lower": {
                    "name": "Temperature Lower",
                    "min": 0,
                    "max": 40,
                    "step": 0.5,
                },
                "growbox_temperature_upper": {
                    "name": "Temperature Upper",
                    "min": 0,
                    "max": 40,
                    "step": 0.5,
                },
                "growbox_humidity_lower": {
                    "name": "Humidity Lower",
                    "min": 0,
                    "max": 100,
                    "step": 1,
                },
                "growbox_humidity_upper": {
                    "name": "Humidity Upper",
                    "min": 0,
                    "max": 100,
                    "step": 1,
                },
                "growbox_vpd_lower": {
                    "name": "VPD Lower",
                    "min": 0,
                    "max": 3,
                    "step": 0.1,
                },
                "growbox_vpd_upper": {
                    "name": "VPD Upper",
                    "min": 0,
                    "max": 3,
                    "step": 0.1,
                },
            }
        },
    )
    await async_setup_component(
        hass,
        "input_datetime",
        {
            "input_datetime": {
                "growbox_light_on": {"name": "Light On", "has_time": True},
                "growbox_light_off": {"name": "Light Off", "has_time": True},
            }
        },
    )
    await hass.async_block_till_done()

    await hass.services.async_call(
        DOMAIN,
        SERVICE_SET_GROWTH_PHASE,
        {"phase": "late-veg"},
        blocking=True,
    )
    await hass.async_block_till_done()

    # Exactly one phase boolean is on: the selected one.
    for phase in GROWTH_PHASES:
        expected = "on" if phase == "late-veg" else "off"
        state = hass.states.get(f"input_boolean.growbox_{phase.replace('-', '_')}")
        assert state is not None
        assert state.state == expected

    # The Target Profile of late-veg is written to the helpers.
    assert (
        float(hass.states.get("input_number.growbox_temperature_lower").state) == 22.0
    )
    assert float(hass.states.get("input_number.growbox_vpd_upper").state) == 1.2
    assert hass.states.get("input_datetime.growbox_light_on").state == "08:00:00"
    assert hass.states.get("input_datetime.growbox_light_off").state == "20:00:00"
