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

# Growth Phases: the single active cultivation stage of a Grow Run.
# Exactly one phase is active at a time (ADR-0002).
GROWTH_PHASES: tuple[str, ...] = (
    "early-veg",
    "late-veg",
    "late-bloom",
    "dry",
    "off",
)

# Target Profile field names for each range and time group.
# Each Growth Phase has one Target Profile with these fields.
TARGET_PROFILE_FIELDS: tuple[str, ...] = (
    # Temperature range (degrees Celsius)
    "temperature_lower",
    "temperature_upper",
    # Humidity range (percentage)
    "humidity_lower",
    "humidity_upper",
    # VPD range (kPa)
    "vpd_lower",
    "vpd_upper",
    # Light schedule (time strings HH:MM)
    "light_on_time",
    "light_off_time",
)

# Soil sensor group field names for a Plant.
# Each Plant has a soil sensor group with these four sensor entities.
SOIL_SENSOR_FIELDS: tuple[str, ...] = (
    "soil_temperature",
    "soil_moisture",
    "soil_illuminance",
    "soil_conductivity",
)

# Maximum number of Plants supported in the options flow.
# In practice, growers use 1-3 plants; no hard technical limit.
MAX_PLANTS: int = 3

# Service names for the Growhelper integration.
SERVICE_SET_GROWTH_PHASE = "set_growth_phase"
