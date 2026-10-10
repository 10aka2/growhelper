"""Config flow for the Growhelper integration.

The config flow creates one config entry per Grow Box. All further
configuration (Entity Roles, Target Profiles, Plants) arrives with the
options flow in a later ticket.
"""

from __future__ import annotations

import voluptuous as vol

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult

from .const import DOMAIN

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
