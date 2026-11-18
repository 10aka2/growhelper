/**
 * Panel constants (phase labels/keys, VPD zones, soil sensor and camera maps,
 * diary tag) shared by the panel modules (issue #32 split).
 */

// Canonical German labels for the Growth Phase keys (domain terms from
// CONTEXT.md). The phase indicator and the VPD zone bands share this map.
export const GROWTH_PHASE_LABELS = {
  'early-veg': 'Frühe Vegetationsphase',
  'late-veg': 'Späte Vegetationsphase',
  'late-bloom': 'Späte Blüte',
  'dry': 'Trocknung',
  'off': 'Aus'
};

// Canonical Growth Phase keys (same order as const.py GROWTH_PHASES); the
// phase indicator, the phase selector and _getGrowthPhase share this list.
export const GROWTH_PHASE_KEYS = ['early-veg', 'late-veg', 'late-bloom', 'dry', 'off'];

// VPD reference zone bands (kPa) - from the PRD. Zones that share a Growth
// Phase key reuse the canonical label from GROWTH_PHASE_LABELS.
export const VPD_ZONES = {
  'under-transpiration': { max: 0.4, label: 'Unter-Transpiration', color: '#ff0000' },
  'early-veg': { min: 0.4, max: 0.8, label: GROWTH_PHASE_LABELS['early-veg'], color: '#ffa500' },
  'late-veg': { min: 0.8, max: 1.2, label: GROWTH_PHASE_LABELS['late-veg'], color: '#ffff00' },
  'mid-late-flower': { min: 1.2, max: 1.6, label: 'Mittlere bis späte Blüte', color: '#00ff00' },
  'danger-zone': { min: 1.6, label: 'Gefahrenzone', color: '#ff00ff' }
};

// Camera rotation styles
export const CAMERA_ROTATION_STYLES = {
  '0': 'rotate(0deg)',
  '90': 'rotate(90deg)',
  '180': 'rotate(180deg)',
  '270': 'rotate(270deg)'
};

// Soil sensor field names for Plants
export const SOIL_SENSOR_FIELDS = ['soil_temperature', 'soil_moisture', 'soil_illuminance', 'soil_conductivity'];

// Maximum number of Plants
export const MAX_PLANTS = 3;

// Soil sensor display names and units
export const SOIL_SENSOR_DISPLAY = {
  'soil_temperature': { label: 'Bodentemperatur', unit: '°C', icon: '🌡️' },
  'soil_moisture': { label: 'Bodenfeuchtigkeit', unit: '%', icon: '💧' },
  'soil_illuminance': { label: 'Bodenbeleuchtung', unit: 'lux', icon: '☀️' },
  'soil_conductivity': { label: 'Bodenleitfähigkeit', unit: 'mS/cm', icon: '⚡' }
};

// Grow Diary constants
export const DIARY_ENTRY_ALL_TAG = 'all';
