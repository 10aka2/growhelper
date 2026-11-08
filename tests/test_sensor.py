"""Tests for the Grow Box configuration sensor (issue #24).

The panel reads its frontend configuration from the attributes of the
`sensor.growhelper_config` state, because config entry options are not
exposed to the frontend. These tests pin that contract: the sensor publishes
the config entry options plus the active Grow Run and the current Growth
Phase, and it follows options and phase-helper changes without polling.
"""

from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.growhelper.const import (
    CONF_ACTIVE_GROW_RUN,
    CONF_GROWTH_PHASE,
    DOMAIN,
    GROWTH_PHASES,
    SERVICE_START_GROW_RUN,
)

CONFIG_SENSOR_ENTITY_ID = "sensor.growhelper_config"

# Entity Role options for a Grow Box, in the shape the options flow stores them.
ENTITY_ROLE_OPTIONS = {
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
    "camera_rotation": "90",
}

# One Target Profile (early-veg) plus one Plant with a soil sensor group.
TARGET_PROFILE_EARLY_VEG = {
    "early-veg_temperature_lower": 20.0,
    "early-veg_temperature_upper": 28.0,
    "early-veg_humidity_lower": 60.0,
    "early-veg_humidity_upper": 80.0,
    "early-veg_vpd_lower": 0.4,
    "early-veg_vpd_upper": 0.8,
    "early-veg_light_on_time": "06:30",
    "early-veg_light_off_time": "18:30",
}

PLANT_1_OPTIONS = {
    "plant_1_name": "Plant 1",
    "plant_1_cultivar": "Banana Boogie Split",
    "plant_1_soil_moisture": "sensor.growbox_soil_moisture_1",
}

ALL_OPTIONS = ENTITY_ROLE_OPTIONS | TARGET_PROFILE_EARLY_VEG | PLANT_1_OPTIONS


async def _setup_entry(
    hass: HomeAssistant, options: dict | None = None
) -> MockConfigEntry:
    """Set up a Growhelper config entry (with the full options by default)."""
    entry = MockConfigEntry(
        domain=DOMAIN,
        data={},
        title="Meine Grow Box",
        options=dict(ALL_OPTIONS if options is None else options),
    )
    entry.add_to_hass(hass)
    await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.LOADED
    return entry


async def _setup_phase_helpers(hass: HomeAssistant) -> None:
    """Create the phase input helpers the options map the phases to."""
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
    await hass.async_block_till_done()


async def test_config_sensor_is_published_with_options(hass: HomeAssistant) -> None:
    """Setup publishes sensor.growhelper_config, state 'configured' (#24).

    The attributes mirror the config entry options so the panel can read its
    frontend configuration from the state, plus active_grow_run and
    growth_phase.
    """
    await _setup_entry(hass)

    state = hass.states.get(CONFIG_SENSOR_ENTITY_ID)
    assert state is not None, "sensor.growhelper_config is not published"
    assert state.state == "configured"

    attributes = state.attributes
    # Entity Roles and camera rotation.
    assert attributes["canopy_temperature"] == "sensor.growbox_canopy_temperature"
    assert attributes["growth_phase_early_veg"] == "input_boolean.growbox_early_veg"
    assert attributes["camera_rotation"] == "90"
    # Target Profile fields of the Growth Phase.
    assert attributes["early-veg_temperature_lower"] == 20.0
    assert attributes["early-veg_light_on_time"] == "06:30"
    # Plant with its soil sensor group.
    assert attributes["plant_1_name"] == "Plant 1"
    assert attributes["plant_1_soil_moisture"] == "sensor.growbox_soil_moisture_1"
    # Derived state: no active Grow Run yet, no phase helper on.
    assert attributes[CONF_ACTIVE_GROW_RUN] == ""
    assert attributes[CONF_GROWTH_PHASE] == "off"


async def test_config_sensor_is_unconfigured_without_options(
    hass: HomeAssistant,
) -> None:
    """Without options the sensor reports 'unconfigured' but still exists."""
    entry = await _setup_entry(hass, options={})
    assert entry.state is ConfigEntryState.LOADED

    state = hass.states.get(CONFIG_SENSOR_ENTITY_ID)
    assert state is not None
    assert state.state == "unconfigured"
    assert state.attributes[CONF_ACTIVE_GROW_RUN] == ""
    assert state.attributes[CONF_GROWTH_PHASE] == "off"


async def test_config_sensor_follows_options_update(hass: HomeAssistant) -> None:
    """An options update (e.g. the active Grow Run) refreshes the sensor.

    grow_diary.async_set_active_grow_run writes the active run through
    hass.config_entries.async_update_entry, so the sensor must listen to
    entry updates — no restart, no polling.
    """
    entry = await _setup_entry(hass)

    hass.config_entries.async_update_entry(
        entry, options={**entry.options, CONF_ACTIVE_GROW_RUN: "grow_run_20261108"}
    )
    await hass.async_block_till_done()

    state = hass.states.get(CONFIG_SENSOR_ENTITY_ID)
    assert state is not None
    assert state.attributes[CONF_ACTIVE_GROW_RUN] == "grow_run_20261108"


async def test_config_sensor_growth_phase_follows_phase_helpers(
    hass: HomeAssistant,
) -> None:
    """The growth_phase attribute tracks the phase input helpers (ADR-0002).

    The panel uses it as the fallback for the active Growth Phase; turning a
    phase helper on must update the sensor via a state-change event.
    """
    await _setup_entry(hass)
    await _setup_phase_helpers(hass)

    state = hass.states.get(CONFIG_SENSOR_ENTITY_ID)
    assert state is not None
    assert state.attributes[CONF_GROWTH_PHASE] == "off"

    await hass.services.async_call(
        "input_boolean",
        "turn_on",
        {"entity_id": "input_boolean.growbox_early_veg"},
        blocking=True,
    )
    await hass.async_block_till_done()
    assert hass.states.get(CONFIG_SENSOR_ENTITY_ID).attributes[CONF_GROWTH_PHASE] == (
        "early-veg"
    )

    await hass.services.async_call(
        "input_boolean",
        "turn_off",
        {"entity_id": "input_boolean.growbox_early_veg"},
        blocking=True,
    )
    await hass.services.async_call(
        "input_boolean",
        "turn_on",
        {"entity_id": "input_boolean.growbox_late_veg"},
        blocking=True,
    )
    await hass.async_block_till_done()
    assert hass.states.get(CONFIG_SENSOR_ENTITY_ID).attributes[CONF_GROWTH_PHASE] == (
        "late-veg"
    )


async def test_start_grow_run_updates_active_run_attribute(
    hass: HomeAssistant,
) -> None:
    """start_grow_run marks the run active and the sensor reflects it.

    End-to-end through the public surface: the service writes the active run
    into the config entry options, the entry update listener refreshes the
    sensor — this is what makes the production dashboard show the run without
    the E2E placeholder.
    """
    await _setup_entry(hass)
    await _setup_phase_helpers(hass)

    result = await hass.services.async_call(
        DOMAIN,
        SERVICE_START_GROW_RUN,
        {},
        blocking=True,
        return_response=True,
    )
    await hass.async_block_till_done()

    # A generated unique name (issue #18/#22): assert against the response
    # instead of a fixed name so reruns never collide with an existing file.
    run_name = result["run_name"]
    assert run_name
    state = hass.states.get(CONFIG_SENSOR_ENTITY_ID)
    assert state is not None
    assert state.attributes[CONF_ACTIVE_GROW_RUN] == run_name
    # start_grow_run also sets the phase to early-veg through the bridge.
    assert state.attributes[CONF_GROWTH_PHASE] == "early-veg"
