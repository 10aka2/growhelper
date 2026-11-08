"""Sensor platform for the Growhelper integration.

Config entry options are not exposed to the Home Assistant frontend, so the
integration publishes the Grow Box configuration as the attributes of one
sensor state (ADR-0003): the panel reads its config from
`sensor.growhelper_config` instead of relying on a test-only placeholder.
The attributes are the config entry options (Entity Roles, camera rotation,
Target Profiles per Growth Phase, Plants, active Grow Run) plus the derived
current Growth Phase.
"""

from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import CALLBACK_TYPE, Event, HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import (
    EventStateChangedData,
    async_track_state_change_event,
)

from .const import (
    CONF_ACTIVE_GROW_RUN,
    CONF_GROWTH_PHASE,
    GROWTH_PHASES,
    growth_phase_role_key,
)

# State values of the config sensor.
STATE_CONFIGURED = "configured"
STATE_UNCONFIGURED = "unconfigured"

# Fixed entity name so the entity id is sensor.growhelper_config — the prefix
# the panel matches. Additional config entries (Grow Boxes) get _2, _3, ...
CONFIG_SENSOR_NAME = "Growhelper Config"


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the Grow Box configuration sensor for a config entry."""
    async_add_entities([GrowhelperConfigSensor(entry)])


class GrowhelperConfigSensor(SensorEntity):
    """Publish the Grow Box configuration to the frontend as state attributes.

    The panel reads its config from these attributes because config entry
    options are not exposed to the frontend (ADR-0003). The sensor follows
    config entry updates (options flow, active Grow Run changes) and state
    changes of the phase input helpers (ADR-0002) — no polling.
    """

    _attr_has_entity_name = False
    _attr_name = CONFIG_SENSOR_NAME
    _attr_icon = "mdi:cog-outline"
    _attr_should_poll = False

    def __init__(self, entry: ConfigEntry) -> None:
        """Initialize the sensor for one Grow Box config entry."""
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_config"
        self._untrack_phase_entities: CALLBACK_TYPE | None = None

    async def async_added_to_hass(self) -> None:
        """Subscribe to entry updates and phase helper state changes."""
        await super().async_added_to_hass()
        self._entry.async_on_unload(
            self._entry.add_update_listener(self._async_entry_updated)
        )
        self._subscribe_phase_entities()
        self._refresh()

    async def async_will_remove_from_hass(self) -> None:
        """Remove the phase helper state-change subscription."""
        self._unsubscribe_phase_entities()
        await super().async_will_remove_from_hass()

    def _phase_entity_ids(self) -> list[str]:
        """Return the entity ids of the phase input helpers mapped in the options."""
        entity_ids = []
        for phase in GROWTH_PHASES:
            entity_id = self._entry.options.get(growth_phase_role_key(phase))
            if entity_id:
                entity_ids.append(entity_id)
        return entity_ids

    def _subscribe_phase_entities(self) -> None:
        """(Re)subscribe to state changes of the phase input helpers."""
        self._unsubscribe_phase_entities()
        entity_ids = self._phase_entity_ids()
        if entity_ids:
            self._untrack_phase_entities = async_track_state_change_event(
                self.hass, entity_ids, self._async_phase_changed
            )

    def _unsubscribe_phase_entities(self) -> None:
        """Remove the phase helper state-change subscription if active."""
        if self._untrack_phase_entities is not None:
            self._untrack_phase_entities()
            self._untrack_phase_entities = None

    async def _async_entry_updated(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        """Refresh when the config entry options change (incl. the active run)."""
        self._subscribe_phase_entities()
        self._refresh()

    @callback
    def _async_phase_changed(self, event: Event[EventStateChangedData]) -> None:
        """Refresh when a phase input helper changes state."""
        self._refresh()

    def _current_growth_phase(self) -> str:
        """Read the active Growth Phase from its input helper (ADR-0002)."""
        for phase in GROWTH_PHASES:
            entity_id = self._entry.options.get(growth_phase_role_key(phase))
            if entity_id:
                state = self.hass.states.get(entity_id)
                if state is not None and state.state == "on":
                    return phase
        return "off"

    def _refresh(self) -> None:
        """Write the current options and derived state to the entity.

        Attribute contract: None-valued optional options are omitted, while
        active_grow_run and growth_phase are always present (active_grow_run
        is '' when no Grow Run is active) so the panel has stable keys.
        """
        options = self._entry.options
        self._attr_native_value = STATE_CONFIGURED if options else STATE_UNCONFIGURED
        attributes: dict[str, Any] = {
            key: value for key, value in options.items() if value is not None
        }
        attributes[CONF_ACTIVE_GROW_RUN] = options.get(CONF_ACTIVE_GROW_RUN) or ""
        attributes[CONF_GROWTH_PHASE] = self._current_growth_phase()
        self._attr_extra_state_attributes = attributes
        self.async_write_ha_state()
