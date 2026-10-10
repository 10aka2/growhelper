"""Services for the Growhelper integration.

v1 bridge: when the Growth Phase changes, the service writes the user's existing
input helpers (ADR-0002) so the existing automations keep working untouched.
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import service

from .const import (
    DOMAIN,
    GROWTH_PHASES,
    SERVICE_SET_GROWTH_PHASE,
)


async def async_setup_services(
    hass: HomeAssistant, entry: ConfigEntry
) -> None:
    """Set up the Growhelper services."""
    
    async def handle_set_growth_phase(call: ServiceCall) -> None:
        """Handle the set_growth_phase service call.

        Applies the Target Profile for the specified Growth Phase by writing
        the values to the mapped input helpers (ADR-0002). Ensures exactly one
        phase boolean is on (exclusively).
        """
        phase = call.data.get("phase")
        
        if phase not in GROWTH_PHASES:
            raise ValueError(
                f"Invalid phase '{phase}'. Must be one of: {', '.join(GROWTH_PHASES)}"
            )
        
        # Get the options from the config entry
        options = entry.options
        
        # Build the mapping from phase field names to entity IDs
        # Phase booleans: growth_phase_early_veg, growth_phase_late_veg, etc.
        phase_entities = {
            phase_name: options.get(f"growth_phase_{phase_name}")
            for phase_name in GROWTH_PHASES
        }
        
        # Threshold and light time entity IDs
        temperature_lower = options.get("temperature_lower_threshold")
        temperature_upper = options.get("temperature_upper_threshold")
        humidity_lower = options.get("humidity_lower_threshold")
        humidity_upper = options.get("humidity_upper_threshold")
        vpd_lower = options.get("vpd_lower_threshold")
        vpd_upper = options.get("vpd_upper_threshold")
        light_on_time = options.get("light_on_time")
        light_off_time = options.get("light_off_time")
        
        # Get the Target Profile values for the specified phase
        phase_prefix = phase
        temp_lower = options.get(f"{phase_prefix}_temperature_lower")
        temp_upper = options.get(f"{phase_prefix}_temperature_upper")
        humidity_lower_val = options.get(f"{phase_prefix}_humidity_lower")
        humidity_upper_val = options.get(f"{phase_prefix}_humidity_upper")
        vpd_lower_val = options.get(f"{phase_prefix}_vpd_lower")
        vpd_upper_val = options.get(f"{phase_prefix}_vpd_upper")
        light_on = options.get(f"{phase_prefix}_light_on_time")
        light_off = options.get(f"{phase_prefix}_light_off_time")
        
        # Write phase booleans: turn off all, then turn on the selected one
        # This ensures exactly one phase boolean is on (exclusivity)
        for p in GROWTH_PHASES:
            entity_id = phase_entities.get(p)
            if entity_id:
                # Turn off all phase booleans first
                await hass.services.async_call(
                    "input_boolean",
                    "turn_off",
                    {"entity_id": entity_id},
                )
        
        # Turn on the selected phase
        selected_entity = phase_entities.get(phase)
        if selected_entity:
            await hass.services.async_call(
                "input_boolean",
                "turn_on",
                {"entity_id": selected_entity},
            )
        
        # Write threshold values from the Target Profile
        if temperature_lower and temp_lower is not None:
            await hass.services.async_call(
                "input_number",
                "set_value",
                {"entity_id": temperature_lower, "value": float(temp_lower)},
            )
        if temperature_upper and temp_upper is not None:
            await hass.services.async_call(
                "input_number",
                "set_value",
                {"entity_id": temperature_upper, "value": float(temp_upper)},
            )
        if humidity_lower and humidity_lower_val is not None:
            await hass.services.async_call(
                "input_number",
                "set_value",
                {"entity_id": humidity_lower, "value": float(humidity_lower_val)},
            )
        if humidity_upper and humidity_upper_val is not None:
            await hass.services.async_call(
                "input_number",
                "set_value",
                {"entity_id": humidity_upper, "value": float(humidity_upper_val)},
            )
        if vpd_lower and vpd_lower_val is not None:
            await hass.services.async_call(
                "input_number",
                "set_value",
                {"entity_id": vpd_lower, "value": float(vpd_lower_val)},
            )
        if vpd_upper and vpd_upper_val is not None:
            await hass.services.async_call(
                "input_number",
                "set_value",
                {"entity_id": vpd_upper, "value": float(vpd_upper_val)},
            )
        if light_on_time and light_on is not None:
            await hass.services.async_call(
                "input_datetime",
                "set_datetime",
                {"entity_id": light_on_time, "time": light_on},
            )
        if light_off_time and light_off is not None:
            await hass.services.async_call(
                "input_datetime",
                "set_datetime",
                {"entity_id": light_off_time, "time": light_off},
            )
    
    # Register the set_growth_phase service
    service.async_register_admin_service(
        hass,
        DOMAIN,
        SERVICE_SET_GROWTH_PHASE,
        handle_set_growth_phase,
        schema=vol.Schema({
            vol.Required("phase"): vol.In(GROWTH_PHASES),
        }),
    )
