"""Config flow for the Growhelper integration.

The config flow creates one config entry per Grow Box. The options flow maps
the Grow Box's Entity Roles (sensors, devices and the writable input helpers)
and the camera rotation; Target Profiles and Plants arrive with later
tickets.
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

from .const import CAMERA_ROTATIONS, DOMAIN, ENTITY_ROLES

DATA_SCHEMA = vol.Schema({vol.Optional("name", default="Growhelper"): str})


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


class GrowhelperOptionsFlow(OptionsFlow):
    """Handle the Growhelper options flow: Entity Roles and camera rotation."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Map the Entity Roles and set the camera rotation."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)
        return self.async_show_form(
            step_id="init",
            data_schema=_entity_role_schema(self.config_entry.options),
        )
