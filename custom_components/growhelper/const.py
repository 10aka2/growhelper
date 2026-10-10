"""Constants for the Growhelper integration."""

DOMAIN = "growhelper"

# Entity Role slots: role key -> (entity domains, required). Read roles
# describe the Grow Box's sensors and devices; the writable helper roles are
# the input helpers the v1 bridge writes when the Growth Phase changes
# (ADR-0002). The power roles are optional companions of their device.
ENTITY_ROLES: dict[str, tuple[list[str], bool]] = {
    # Read roles: Grow Box sensors and devices.
    "canopy_temperature": (["sensor"], True),
    "canopy_humidity": (["sensor"], True),
    "vpd_sensor": (["sensor"], True),
    "camera": (["camera"], True),
    "humidifier": (["switch", "light"], True),
    "dehumidifier": (["switch", "light"], True),
    "exhaust_fan": (["switch", "light"], True),
    "ventilation_fan": (["switch", "light"], True),
    "grow_light": (["switch", "light"], True),
    # Optional power sensors, one per device.
    "humidifier_power": (["sensor"], False),
    "dehumidifier_power": (["sensor"], False),
    "exhaust_fan_power": (["sensor"], False),
    "ventilation_fan_power": (["sensor"], False),
    "grow_light_power": (["sensor"], False),
    # Writable helper roles (ADR-0002): what the phase switch writes.
    "growth_phase_early_veg": (["input_boolean"], True),
    "growth_phase_late_veg": (["input_boolean"], True),
    "growth_phase_late_bloom": (["input_boolean"], True),
    "growth_phase_dry": (["input_boolean"], True),
    "growth_phase_off": (["input_boolean"], True),
    "temperature_lower_threshold": (["input_number"], True),
    "temperature_upper_threshold": (["input_number"], True),
    "humidity_lower_threshold": (["input_number"], True),
    "humidity_upper_threshold": (["input_number"], True),
    "vpd_lower_threshold": (["input_number"], True),
    "vpd_upper_threshold": (["input_number"], True),
    "light_on_time": (["input_datetime"], True),
    "light_off_time": (["input_datetime"], True),
}

# Selectable camera rotations in degrees.
CAMERA_ROTATIONS: tuple[str, ...] = ("0", "90", "180", "270")
