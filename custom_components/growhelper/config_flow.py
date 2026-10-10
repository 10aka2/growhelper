"""Config flow for the Growhelper integration.

The config flow creates one config entry per Grow Box. The options flow maps
the Grow Box's Entity Roles (sensors, devices and the writable input helpers),
the camera rotation, and the Target Profiles per Growth Phase.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlow,
)
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
    CAMERA_ROTATIONS,
    DOMAIN,
    ENTITY_ROLES,
    GROWTH_PHASES,
    TARGET_PROFILE_FIELDS,
)

DATA_SCHEMA = vol.Schema({vol.Optional("name", default="Growhelper"): str})


def _entity_role_schema(defaults: Mapping[str, Any]) -> vol.Schema:
    """Build the options schema: one entity picker per Entity Role.

    Current values are offered as suggested values so the form pre-fills on
    reopen. Optional power roles stay clearable: a suggested value is shown
    but not forced into the submission the way a default would be.
    """
    fields: dict[vol.Marker, Any] = {}
    for role, (domains, required) in ENTITY_ROLES.items():
        marker = vol.Required if required else vol.Optional
        fields[
            marker(role, description={"suggested_value": defaults.get(role)})
        ] = selector.EntitySelector(selector.EntitySelectorConfig(domain=domains))
    fields[
        vol.Required("camera_rotation", default=defaults.get("camera_rotation", "0"))
    ] = selector.SelectSelector(
        selector.SelectSelectorConfig(
            options=list(CAMERA_ROTATIONS),
            mode=selector.SelectSelectorMode.DROPDOWN,
        )
    )
    return vol.Schema(fields)





def _combined_schema(defaults: Mapping[str, Any]) -> vol.Schema:
    """Build the combined options schema with Entity Roles and Target Profiles.

    This schema includes all Entity Role pickers, camera rotation, and all
    Target Profile fields for all Growth Phases.
    """
    # Start with Entity Roles
    fields: dict[vol.Marker, Any] = {}
    for role, (domains, required) in ENTITY_ROLES.items():
        marker = vol.Required if required else vol.Optional
        fields[
            marker(role, description={"suggested_value": defaults.get(role)})
        ] = selector.EntitySelector(selector.EntitySelectorConfig(domain=domains))

    # Add camera rotation
    fields[
        vol.Required("camera_rotation", default=defaults.get("camera_rotation", "0"))
    ] = selector.SelectSelector(
        selector.SelectSelectorConfig(
            options=list(CAMERA_ROTATIONS),
            mode=selector.SelectSelectorMode.DROPDOWN,
        )
    )

    # Add Target Profiles for all Growth Phases
    for phase in GROWTH_PHASES:
        # Temperature range
        fields[
            vol.Required(
                f"{phase}_temperature_lower",
                default=defaults.get(f"{phase}_temperature_lower", 20.0),
            )
        ] = vol.Coerce(float)
        fields[
            vol.Required(
                f"{phase}_temperature_upper",
                default=defaults.get(f"{phase}_temperature_upper", 28.0),
            )
        ] = vol.Coerce(float)

        # Humidity range
        fields[
            vol.Required(
                f"{phase}_humidity_lower",
                default=defaults.get(f"{phase}_humidity_lower", 40.0),
            )
        ] = vol.Coerce(float)
        fields[
            vol.Required(
                f"{phase}_humidity_upper",
                default=defaults.get(f"{phase}_humidity_upper", 70.0),
            )
        ] = vol.Coerce(float)

        # VPD range
        fields[
            vol.Required(
                f"{phase}_vpd_lower",
                default=defaults.get(f"{phase}_vpd_lower", 0.4),
            )
        ] = vol.Coerce(float)
        fields[
            vol.Required(
                f"{phase}_vpd_upper",
                default=defaults.get(f"{phase}_vpd_upper", 1.2),
            )
        ] = vol.Coerce(float)

        # Light schedule
        fields[
            vol.Required(
                f"{phase}_light_on_time",
                default=defaults.get(f"{phase}_light_on_time", "08:00"),
            )
        ] = str
        fields[
            vol.Required(
                f"{phase}_light_off_time",
                default=defaults.get(f"{phase}_light_off_time", "20:00"),
            )
        ] = str

    return vol.Schema(fields)


class GrowhelperConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle the Growhelper config flow."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, str] | None = None
    ) -> ConfigFlowResult:
        """Create a config entry for one Grow Box."""
        if user_input is not None:
            return self.async_create_entry(title=user_input["name"], data={})
        return self.async_show_form(step_id="user", data_schema=DATA_SCHEMA)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> GrowhelperOptionsFlow:
        """Return the options flow for a Grow Box config entry."""
        return GrowhelperOptionsFlow()


class GrowhelperOptionsFlow(OptionsFlow):
    """Handle the Growhelper options flow: Entity Roles, camera rotation, and Target Profiles."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Configure Entity Roles, camera rotation, and Target Profiles.

        Shows a single form with all configuration options: Entity Role pickers,
        camera rotation selector, and Target Profile fields for all Growth Phases.
        All range fields are validated (lower < upper).
        """
        if user_input is not None:
            # Validate all Target Profile ranges before storing
            errors: dict[str, str] = {}
            for phase in GROWTH_PHASES:
                # Check temperature range
                temp_lower = user_input.get(f"{phase}_temperature_lower")
                temp_upper = user_input.get(f"{phase}_temperature_upper")
                if temp_lower is not None and temp_upper is not None:
                    if temp_lower >= temp_upper:
                        errors[f"{phase}_temperature_lower"] = "must be less than upper"
                        errors[f"{phase}_temperature_upper"] = "must be greater than lower"

                # Check humidity range
                humidity_lower = user_input.get(f"{phase}_humidity_lower")
                humidity_upper = user_input.get(f"{phase}_humidity_upper")
                if humidity_lower is not None and humidity_upper is not None:
                    if humidity_lower >= humidity_upper:
                        errors[f"{phase}_humidity_lower"] = "must be less than upper"
                        errors[f"{phase}_humidity_upper"] = "must be greater than lower"

                # Check VPD range
                vpd_lower = user_input.get(f"{phase}_vpd_lower")
                vpd_upper = user_input.get(f"{phase}_vpd_upper")
                if vpd_lower is not None and vpd_upper is not None:
                    if vpd_lower >= vpd_upper:
                        errors[f"{phase}_vpd_lower"] = "must be less than upper"
                        errors[f"{phase}_vpd_upper"] = "must be greater than lower"

            if errors:
                return self.async_show_form(
                    step_id="init",
                    data_schema=_combined_schema(self.config_entry.options),
                    errors=errors,
                )

            return self.async_create_entry(title="", data=user_input)

        return self.async_show_form(
            step_id="init",
            data_schema=_combined_schema(self.config_entry.options),
        )
