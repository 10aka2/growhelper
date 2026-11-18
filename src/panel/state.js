/**
 * Config/entity state loading from hass, growth phase/admin accessors and the service-call helper.
 */
import { GROWTH_PHASE_LABELS, GROWTH_PHASE_KEYS, CAMERA_ROTATION_STYLES, SOIL_SENSOR_FIELDS, MAX_PLANTS, DIARY_ENTRY_ALL_TAG } from './constants.js';

export const stateMethods = {

  /** Load the panel config from hass when available (delegates to _loadConfigFromHass). */
  _loadConfig() {
    if (this._hass && this._hass.states) {
      this._loadConfigFromHass();
    }
  },

  /** Load config and state in dependency order so phase targets match live helpers. */
  _loadConfigFromHass() {
    if (!this._hass || !this._hass.states) return;

    // Config entries are not exposed to the frontend, so the backend publishes
    // the Grow Box options as the attributes of the sensor.growhelper_config
    // state (ADR-0003) and the panel reads its config from there.
    var configState = null;
    for (var entityId in this._hass.states) {
      if (entityId.startsWith('sensor.growhelper_config') || entityId.startsWith('growhelper.config')) {
        configState = this._hass.states[entityId];
        break;
      }
    }

    if (configState && configState.attributes) {
      this._config = configState.attributes;
    } else {
      // Fallback: empty config
      this._config = {};
    }

    this._loadEntityStates();
    this._growthPhase = this._getGrowthPhase();
    this._loadTargetProfile();
    this._loadActiveGrowRun();
    this._loadPlants();
    this._loadDiaryContent();
  },

  /** Load the active Target Profile so thresholds and light times use its values. */
  _loadTargetProfile() {
    var phase = this._growthPhase || this._config.growth_phase || 'early-veg';
    this._targetProfile = {
      temperature: {
        lower: this._config[phase + '_temperature_lower'] || 20,
        upper: this._config[phase + '_temperature_upper'] || 28
      },
      humidity: {
        lower: this._config[phase + '_humidity_lower'] || 40,
        upper: this._config[phase + '_humidity_upper'] || 70
      },
      vpd: {
        lower: this._config[phase + '_vpd_lower'] || 0.4,
        upper: this._config[phase + '_vpd_upper'] || 1.2
      },
      light: {
        on: this._config[phase + '_light_on_time'] || '08:00',
        off: this._config[phase + '_light_off_time'] || '20:00'
      }
    };
  },

  /** Load the active Grow Run from the config sensor; keeps the backend-discovered run when the attribute is absent (ADR-0003). */
  _loadActiveGrowRun() {
    // Only override from the config when it actually carries the active run.
    // The sensor carries active_grow_run only while a run is active, so a run
    // set from the backend (start_grow_run / get_diary_content) must survive
    // hass updates that arrive before the sensor state does.
    if (this._config.active_grow_run) {
      this._activeGrowRun = this._config.active_grow_run;
    }
  },

  /** Build the Plant list so each card uses its configured soil sensor group. */
  _loadPlants() {
    this._plants = [];

    for (var plantIndex = 1; plantIndex <= MAX_PLANTS; plantIndex++) {
      var prefix = 'plant_' + plantIndex;
      var name = this._config[prefix + '_name'];

      // Only create plant entry if it has a name
      if (name && name.trim()) {
        var plant = {
          name: name,
          cultivar: this._config[prefix + '_cultivar'] || '',
          sensors: {}
        };

        // Load all soil sensor entities for this plant
        for (var i = 0; i < SOIL_SENSOR_FIELDS.length; i++) {
          var sensorField = SOIL_SENSOR_FIELDS[i];
          var sensorEntityId = this._config[prefix + '_' + sensorField];
          plant.sensors[sensorField] = sensorEntityId || null;
        }

        this._plants.push(plant);
      }
    }
  },

  /** Apply a get_diary_content response; an empty run_name never wipes local state. */
  _applyDiaryResponse(resp) {
    if (!resp || !resp.run_name) {
      return;
    }
    this._activeGrowRun = resp.run_name;
    this._diaryRunName = resp.run_name;
    this._diaryContent = resp.content || '';
    this._render();
  },

  /** Extract a human-readable message from a service-call error object. */
  _errorText(error) {
    return error && error.message ? error.message : String(error);
  },

  /** Fetch the active run's Markdown file so the dashboard shows its source-of-truth diary. */
  _loadDiaryContent() {
    if (!this._hass || !this._hass.callService) {
      return;
    }

    if (!this._activeGrowRun) {
      // No active run known yet (e.g. after a page reload): ask the backend
      // via get_diary_content instead of wiping the display on every hass
      // update. The config sensor carries active_grow_run only once a run is
      // active. A failed attempt is retried on a later hass update.
      if (this._diaryDiscoveryDone || this._diaryDiscoveryInFlight) {
        return;
      }
      this._diaryDiscoveryInFlight = true;
      var discoveryCall = this._callHassService('growhelper', 'get_diary_content', {}, true);
      if (!discoveryCall || typeof discoveryCall.then !== 'function') {
        this._diaryDiscoveryInFlight = false;
        return;
      }
      discoveryCall
        .then((response) => {
          this._diaryDiscoveryInFlight = false;
          this._diaryDiscoveryDone = true;
          this._applyDiaryResponse(response.response || response);
        })
        .catch((error) => {
          this._diaryDiscoveryInFlight = false;
          this._diaryDiscoveryDone = false;
          console.error('Error discovering active Grow Run:', error);
        });
      return;
    }

    if (this._diaryRunName === this._activeGrowRun) {
      return;
    }

    var requestedRunName = this._activeGrowRun;
    this._diaryRunName = requestedRunName;
    var fetchCall = this._callHassService('growhelper', 'get_diary_content', {}, true);
    if (!fetchCall || typeof fetchCall.then !== 'function') {
      return;
    }
    fetchCall
      .then((response) => {
        if (this._activeGrowRun !== requestedRunName) {
          return;
        }
        this._applyDiaryResponse(response.response || response);
      })
      .catch((error) => {
        if (this._activeGrowRun !== requestedRunName) {
          return;
        }
        // Keep the active run and the last known content; retry on a later
        // hass update by clearing the loaded-run marker.
        this._diaryRunName = '';
        console.error('Error loading Grow Diary:', error);
        this._render();
      });
  },

  /** Plant tag options for the diary form: the box-level "all" tag plus every configured Plant. */
  _getPlantTagOptions() {
    // Plant tag options: the box-level "all" tag plus every configured Plant
    var options = [{ value: DIARY_ENTRY_ALL_TAG, label: 'Alle Pflanzen' }];

    for (var i = 0; i < this._plants.length; i++) {
      var plant = this._plants[i];
      options.push({ value: plant.name, label: plant.name });
    }

    return options;
  },

  /** Call a Home Assistant service, optionally requesting its response data. */
  _callHassService(domain, service, serviceData, returnResponse = false) {
    if (this._hass && this._hass.callService) {
      try {
        return this._hass.callService(
          domain,
          service,
          serviceData,
          undefined,
          true,
          returnResponse
        );
      } catch (error) {
        console.error('Error calling service:', domain, service, error);
        // Return a rejected promise so callers' .catch handlers (e.g. the
        // error banner) still attach.
        return Promise.reject(error);
      }
    } else {
      console.log('Service call (simulated):', domain, service, serviceData);
    }
  },

  /** Snapshot all hass states into _entityStates so each render reads a consistent view. */
  _loadEntityStates() {
    if (!this._hass || !this._hass.states) return;

    // Load all entity states
    this._entityStates = {};
    Object.keys(this._hass.states).forEach(function(entityId) {
      this._entityStates[entityId] = this._hass.states[entityId];
    }.bind(this));

    // Load camera image
    this._loadCameraImage();
  },

  /** Cache the camera entity's current image (entity_picture) for the camera section. */
  _loadCameraImage() {
    if (!this._config.camera) return;

    var cameraEntity = this._entityStates[this._config.camera];
    if (cameraEntity && cameraEntity.attributes && cameraEntity.attributes.entity_picture) {
      this._cameraImage = cameraEntity.attributes.entity_picture;
    } else {
      this._cameraImage = '';
    }
  },

  /** Return the cached state object for an entity id (undefined when unknown). */
  _getEntityState(entityId) {
    return this._entityStates[entityId];
  },

  /** Return an entity's state value (e.g. 'on'/'off'), or null when the entity is unknown. */
  _getEntityValue(entityId) {
    var state = this._getEntityState(entityId);
    return state ? state.state : null;
  },

  /** Resolve the active Growth Phase from its configured input helper (ADR-0002); 'off' when none is on. */
  _getGrowthPhase() {
    // Find the active Growth Phase through its configured input helper.
    var phases = GROWTH_PHASE_KEYS;
    for (var i = 0; i < phases.length; i++) {
      var phase = phases[i];
      var entityKey = 'growth_phase_' + phase.replace(/-/g, '_');
      var entityId = this._config[entityKey];
      if (entityId && this._getEntityValue(entityId) === 'on') {
        return phase;
      }
    }
    return 'off';
  },

  /** CSS transform for the configured camera rotation. */
  _getCameraRotationStyle() {
    var rotation = this._config.camera_rotation || '0';
    return CAMERA_ROTATION_STYLES[rotation] || 'rotate(0deg)';
  },

  /** Return the German label corresponding to the active Growth Phase key. */
  _getGrowthPhaseLabel() {
    return GROWTH_PHASE_LABELS[this._growthPhase] || GROWTH_PHASE_LABELS.off;
  },

  /** Whether the logged-in user may call the admin-only write services.
   *
   * growhelper.set_growth_phase stays admin-only on purpose (issue #29
   * decision): the panel only offers the phase selector to admins, everyone
   * else gets the read-only phase indicator.
   */
  _isAdmin() {
    return !!(this._hass && this._hass.user && this._hass.user.is_admin);
  }
};
