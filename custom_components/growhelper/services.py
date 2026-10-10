"""Services for the Growhelper integration.

v1 bridge: when the Growth Phase changes, the service writes the user's existing
input helpers (ADR-0002) so the existing automations keep working untouched.

This module also provides the Grow Diary services:
- start_grow_run: Creates a new Grow Run, marks it active, sets phase to early-veg
- add_diary_entry: Appends an entry to the active Grow Run's diary file in ADR-0001 format
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import service

from .const import (
    DOMAIN,
    GROWTH_PHASES,
    SERVICE_SET_GROWTH_PHASE,
    SERVICE_START_GROW_RUN,
    SERVICE_ADD_DIARY_ENTRY,
)
from . import grow_diary


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
    
    async def handle_start_grow_run(call: ServiceCall) -> dict[str, Any]:
        """Handle the start_grow_run service call.
        
        Creates a new Grow Run with an empty diary file, marks it as active,
        and sets the Growth Phase to 'early-veg'.
        
        Args:
            call: Service call with optional 'name' parameter for custom run name
            
        Returns:
            Dictionary with 'run_name' and 'file_path' of the created Grow Run
            
        Raises:
            ValueError: If a Grow Run with the same name already exists
        """
        custom_name = call.data.get("name")
        
        run_name, file_path = await grow_diary.async_start_grow_run(
            hass, entry, run_name=custom_name
        )
        
        return {
            "run_name": run_name,
            "file_path": str(file_path),
        }
    
    # Register the start_grow_run service
    service.async_register_admin_service(
        hass,
        DOMAIN,
        SERVICE_START_GROW_RUN,
        handle_start_grow_run,
        schema=vol.Schema({
            vol.Optional("name"): str,
        }),
    )
    
    async def handle_add_diary_entry(call: ServiceCall) -> dict[str, Any]:
        """Handle the add_diary_entry service call.
        
        Appends an entry to the active Grow Run's diary file in ADR-0001 format.
        The entry includes a date header, optional event title, note bullet with
        plant tag, and separator.
        
        Args:
            call: Service call with 'note', optional 'plant_tag', 'event_title', 'date'
            
        Returns:
            Dictionary with 'file_path' and 'entry' details
            
        Raises:
            ValueError: If no Grow Run is currently active
            FileNotFoundError: If the active Grow Run's diary file doesn't exist
        """
        note = call.data.get("note")
        plant_tag = call.data.get("plant_tag", "all")
        event_title = call.data.get("event_title")
        date_str = call.data.get("date")
        
        # Parse date if provided
        entry_date = None
        if date_str:
            try:
                # Try to parse various date formats
                # ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS
                if "T" in date_str:
                    entry_date = datetime.fromisoformat(date_str)
                else:
                    # Try DD.MM.YYYY format (ADR-0001)
                    entry_date = datetime.strptime(date_str, "%d.%m.%Y")
            except ValueError:
                # If parsing fails, use current date
                entry_date = None
        
        file_path = await grow_diary.async_append_diary_entry(
            hass,
            entry,
            note=note,
            plant_tag=plant_tag,
            event_title=event_title,
            date=entry_date,
        )
        
        return {
            "file_path": str(file_path),
            "note": note,
            "plant_tag": plant_tag,
            "event_title": event_title,
            "date": date_str,
        }
    
    # Register the add_diary_entry service
    service.async_register_admin_service(
        hass,
        DOMAIN,
        SERVICE_ADD_DIARY_ENTRY,
        handle_add_diary_entry,
        schema=vol.Schema({
            vol.Required("note"): str,
            vol.Optional("plant_tag", default="all"): str,
            vol.Optional("event_title"): str,
            vol.Optional("date"): str,
        }),
    )
