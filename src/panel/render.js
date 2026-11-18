/**
 * _render and the per-section render methods.
 */
import { GROWTH_PHASE_LABELS, GROWTH_PHASE_KEYS, VPD_ZONES, SOIL_SENSOR_FIELDS, SOIL_SENSOR_DISPLAY } from './constants.js';
import { PANEL_STYLES } from './styles.js';

export const renderMethods = {

  /** Render each Plant's soil readings so growers can monitor its condition. */
  _renderPlantsSection() {
    // Check if there are any plants configured
    if (!this._plants || this._plants.length === 0) {
      return '<p class="empty">Keine Pflanzen konfiguriert.</p>';
    }

    var htmlContent = '<div class="plants-grid">';

    for (var i = 0; i < this._plants.length; i++) {
      var plant = this._plants[i];
      var plantId = 'plant-' + (i + 1);

      htmlContent += '<div class="plant-card" data-plant-id="' + plantId + '"><div class="plant-header"><span class="plant-name">' + this._escapeHtml(plant.name) + '</span>';

      if (plant.cultivar) {
        htmlContent += '<span class="plant-cultivar">' + this._escapeHtml(plant.cultivar) + '</span>';
      }

      htmlContent += '</div><div class="plant-sensors">';

      // Render each soil sensor for this plant
      for (var j = 0; j < SOIL_SENSOR_FIELDS.length; j++) {
        var sensorField = SOIL_SENSOR_FIELDS[j];
        var sensorInfo = SOIL_SENSOR_DISPLAY[sensorField];
        var sensorEntityId = plant.sensors[sensorField];
        var sensorValue = null;
        var sensorState = null;

        if (sensorEntityId) {
          sensorState = this._getEntityState(sensorEntityId);
          if (sensorState) {
            sensorValue = sensorState.state;
          }
        }

        // Determine if sensor is available and has a value
        var hasSensor = sensorEntityId && sensorValue !== null && sensorValue !== undefined && sensorValue !== 'unavailable' && sensorValue !== 'unknown';

        htmlContent += '<div class="plant-sensor-card ' + (hasSensor ? 'has-value' : 'empty') + '"><div class="sensor-icon">' + sensorInfo.icon + '</div><div class="sensor-label">' + sensorInfo.label + '</div><div class="sensor-value">';

        if (hasSensor) {
          htmlContent += this._formatNumber(sensorValue, 1) + ' <span class="sensor-unit">' + sensorInfo.unit + '</span>';
        } else {
          htmlContent += '<span class="sensor-unavailable">––</span>';
        }

        htmlContent += '</div><div class="sensor-chart"><div class="chart-placeholder">' + sensorInfo.label + '-Verlauf (24h)</div></div></div>';
      }

      htmlContent += '<button class="btn btn-secondary plant-quick-entry" data-action="quick-entry" data-plant-tag="' + this._escapeAttribute(plant.name) + '" title="Tagebuch-Eintrag für diese Pflanze">📝 Eintrag</button></div></div>';
    }

    htmlContent += '</div>';

    return htmlContent;
  },

  /** Render the active Grow Run and its Grow Diary so entries stay in context. */
  _renderDiarySection() {
    var htmlContent = '';

    // Show active grow run info
    if (this._activeGrowRun) {
      htmlContent += '<div class="diary-header"><span class="active-run-info"><strong>Aktiver Grow Run:</strong> ' + this._escapeHtml(this._activeGrowRun) + '</span><button class="btn btn-primary" data-action="start-new-run">🆕 Neuen Grow Run starten</button></div>';
    } else {
      htmlContent += '<div class="diary-header"><p class="empty">Kein aktiver Grow Run. Starte einen neuen, um Einträge hinzuzufügen.</p><button class="btn btn-primary" data-action="start-new-run">🆕 Neuen Grow Run starten</button></div>';
    }

    // Show diary content
    if (this._diaryContent) {
      htmlContent += '<div class="diary-content markdown-body">' + this._renderMarkdown(this._diaryContent) + '</div>';
    } else if (this._activeGrowRun) {
      htmlContent += '<div class="diary-content empty"><p>Keine Einträge für diesen Grow Run.</p></div>';
    }

    // Entry form
    htmlContent += '<div class="diary-entry-form"><button class="btn btn-secondary" data-action="toggle-entry-form">' + (this._showEntryForm ? '❌ Abbrechen' : '➕ Neuer Eintrag') + '</button>' + (this._showEntryForm ? this._renderEntryForm() : '') + '</div>';

    return htmlContent;
  },

  /** Render the diary form with available Plants so entries can be tagged correctly. */
  _renderEntryForm() {
    var plantOptions = this._getPlantTagOptions();
    var optionsHtml = '';

    for (var i = 0; i < plantOptions.length; i++) {
      var option = plantOptions[i];
      var selected = option.value === this._entryFormData.plant_tag ? 'selected' : '';
      optionsHtml += '<option value="' + this._escapeHtml(option.value) + '" ' + selected + '>' + this._escapeHtml(option.label) + '</option>';
    }

    return '<div class="entry-form-container"><div class="form-group"><label>Datum:</label><input type="date" class="diary-input" data-field="date" value="' + this._entryFormData.date + '"></div><div class="form-group"><label>Ereignis (optional):</label><input type="text" class="diary-input" data-field="event_title" value="' + this._escapeHtml(this._entryFormData.event_title) + '" placeholder="z.B. Bewässerung, Düngung"></div><div class="form-group"><label>Pflanze:</label><select class="diary-input" data-field="plant_tag">' + optionsHtml + '</select></div><div class="form-group"><label>Notiz:</label><textarea class="diary-input" data-field="note" placeholder="Was ist passiert?" rows="3">' + this._escapeHtml(this._entryFormData.note) + '</textarea></div><div class="form-actions"><button class="btn btn-primary" data-action="submit-entry">✅ Eintrag hinzufügen</button></div></div>';
  },

  /** Render the Growth Phase indicator: a selector for admins, plain text otherwise. */
  _renderGrowthPhaseControl() {
    if (!this._isAdmin()) {
      return `<span>${this._escapeHtml(this._getGrowthPhaseLabel())}</span>`;
    }
    var options = GROWTH_PHASE_KEYS.map((phase) => {
      var selected = phase === this._growthPhase ? ' selected' : '';
      return `<option value="${this._escapeAttribute(phase)}"${selected}>${this._escapeHtml(GROWTH_PHASE_LABELS[phase])}</option>`;
    }).join('');
    return `<select class="phase-select" data-action="set-phase" title="Growth Phase wechseln">${options}</select>`;
  },

  /** Render the camera content or its German empty state. */
  _renderCameraSection(hasCamera) {
    if (!hasCamera) {
      return '<p class="empty">Keine Kamera konfiguriert oder verfügbar.</p>';
    }

    var rotation = this._config.camera_rotation || '0';
    return `<div class="camera-container">
      <img src="${this._escapeHtml(this._cameraImage)}" style="transform: ${this._getCameraRotationStyle()};">
      <div class="camera-rotation-info">Rotation: ${this._escapeHtml(rotation)}°</div>
    </div>`;
  },

  /** Render the target indicator for a numeric value when it has a target. */
  _renderThresholdIndicator(value, target) {
    var numericValue = this._safeParseFloat(value);
    var inRange = this._isInRange(numericValue, target.lower, target.upper);

    if (inRange === true) {
      return '<span class="threshold-indicator in-range" title="Im Zielbereich"></span>';
    }
    if (inRange === false && numericValue < target.lower) {
      return '<span class="threshold-indicator below-range" title="Unter dem Zielbereich"></span>';
    }
    if (inRange === false) {
      return '<span class="threshold-indicator above-range" title="Über dem Zielbereich"></span>';
    }
    return '';
  },

  /** Render one environment reading together with its target and history stub. */
  _renderEnvironmentReading(label, value, unit, target, chartLabel) {
    return `<div class="env-card">
      <div class="label">${label}</div>
      <div class="value">
        ${this._formatNumber(value, 1)}
        <span class="unit">${unit}</span>
        ${this._renderThresholdIndicator(value, target)}
      </div>
      <div class="chart-container"><div class="chart-placeholder">${chartLabel} (24h)</div></div>
    </div>`;
  },

  /** Render the available canopy temperature and humidity readings. */
  _renderEnvironmentSection(hasTemperature, hasHumidity, currentValues) {
    if (!hasTemperature && !hasHumidity) {
      return '<p class="empty">Keine Umgebungs-Sensoren konfiguriert oder verfügbar.</p>';
    }

    return `<div class="environment-grid">
      ${hasTemperature ? this._renderEnvironmentReading(
        'Temperatur', currentValues.temperature, '°C', this._targetProfile.temperature, 'Temperaturverlauf'
      ) : ''}
      ${hasHumidity ? this._renderEnvironmentReading(
        'Luftfeuchtigkeit', currentValues.humidity, '%', this._targetProfile.humidity, 'Luftfeuchtigkeitsverlauf'
      ) : ''}
    </div>`;
  },

  /** Render the current VPD reading and its translated reference zones. */
  _renderVpdSection(hasVPD, currentValue) {
    if (!hasVPD) {
      return '<p class="empty">Kein VPD-Sensor konfiguriert oder verfügbar.</p>';
    }

    var numericValue = this._safeParseFloat(currentValue);
    var inRange = this._isInRange(numericValue, this._targetProfile.vpd.lower, this._targetProfile.vpd.upper);
    var zones = Object.keys(VPD_ZONES).map((key) => {
      var zone = VPD_ZONES[key];
      var isActive = numericValue !== null && (
        zone.min === undefined ? numericValue < zone.max :
          zone.max === undefined ? numericValue >= zone.min :
            numericValue >= zone.min && numericValue <= zone.max
      );
      var range = zone.min === undefined ? `&lt; ${zone.max} kPa` :
        zone.max === undefined ? `&gt; ${zone.min} kPa` :
          `${zone.min}–${zone.max} kPa`;

      return `<div class="vpd-zone">
        <div class="vpd-zone-color" style="background: ${zone.color};"></div>
        <div class="vpd-zone-label">${zone.label}</div>
        <div class="vpd-zone-range">${range}</div>
        ${isActive ? `<div class="vpd-current-indicator" style="background: ${zone.color};"></div>` : ''}
      </div>`;
    }).join('');

    return `<div class="vpd-container">
      <div class="vpd-value-display">
        <div class="vpd-value">${this._formatNumber(currentValue, 2)}</div>
        <div class="vpd-unit">kPa</div>
        <div class="status-badge ${inRange === true ? 'active' : 'inactive'}">
          ${inRange === true ? 'Im Zielbereich' : 'Außerhalb des Zielbereichs'}
        </div>
      </div>
      <div class="vpd-zones">${zones}</div>
    </div>
    <div class="chart-container"><div class="chart-placeholder">VPD-Verlauf (24h)</div></div>`;
  },

  /** Render a climate device and its optional power reading; clickable to toggle (issue #28). */
  _renderDeviceCard(icon, name, state, power, entityId) {
    var isOn = state === 'on';
    var powerMarkup = power === null || power === undefined || power === '' ? '' :
      `<div class="device-power">${this._escapeHtml(power)} W</div>`;
    return `<div class="device-card" data-action="toggle-device" data-entity-id="${this._escapeAttribute(entityId)}" title="Gerät ein-/ausschalten">
      <div class="device-icon">${icon}</div>
      <div class="device-name">${name}</div>
      <div class="device-state ${isOn ? 'on' : 'off'}">${isOn ? 'EIN' : 'AUS'}</div>
      ${powerMarkup}
    </div>`;
  },

  /** Render configured climate devices without including the grow light. */
  _renderClimateSection(renderContext) {
    var entities = renderContext.entities;
    var currentValues = renderContext.currentValues;
    var devices = [
      ['humidifier', '💦', 'Befeuchter', 'humidifier_power'],
      ['dehumidifier', '🌬️', 'Entfeuchter', 'dehumidifier_power'],
      ['exhaust_fan', '💨', 'Abluft', 'exhaust_fan_power'],
      ['ventilation_fan', '🌀', 'Belüftung', 'ventilation_fan_power']
    ].filter(([key]) => entities[key]);

    if (devices.length === 0) {
      return '<p class="empty">Keine Klima-Geräte konfiguriert oder verfügbar.</p>';
    }

    return `<div class="devices-grid">${devices.map(([key, icon, name, powerKey]) =>
      this._renderDeviceCard(icon, name, currentValues[key], currentValues[powerKey], entities[key])
    ).join('')}</div>`;
  },

  /** Render the grow-light schedule, state, and optional power reading. */
  _renderLightSection(renderContext) {
    var entities = renderContext.entities;
    var currentValues = renderContext.currentValues;
    if (!entities.grow_light) {
      return '<p class="empty">Keine Licht-Steuerung konfiguriert oder verfügbar.</p>';
    }

    var isOn = currentValues.grow_light === 'on';
    var lightOn = this._targetProfile.light?.on || '08:00';
    var lightOff = this._targetProfile.light?.off || '20:00';
    var powerMarkup = currentValues.grow_light_power === null || currentValues.grow_light_power === undefined ? '' :
      `<div style="margin-top: 8px; font-size: 14px; color: var(--secondary-text-color, #727272);">
        Leistung: ${this._escapeHtml(currentValues.grow_light_power)} W
      </div>`;

    return `<div class="light-schedule">
      <div class="light-time"><span class="light-time-icon">🌅</span><span class="light-time-value">${this._escapeHtml(lightOn)}</span></div>
      <div class="light-time"><span class="light-time-icon">🌇</span><span class="light-time-value">${this._escapeHtml(lightOff)}</span></div>
      <div class="light-state ${isOn ? 'on' : 'off'}" data-action="toggle-device" data-entity-id="${this._escapeAttribute(entities.grow_light)}" title="Licht ein-/ausschalten">${isOn ? 'EINGESCHALTET' : 'AUSGESCHALTET'}</div>
    </div>${powerMarkup}`;
  },

  /** Rebuild the dashboard so every section reflects the latest Home Assistant state. */
  _render() {
    // Get current growth phase
    this._growthPhase = this._getGrowthPhase();

    // Get entity IDs from config
    var entities = {
      canopy_temperature: this._config.canopy_temperature,
      canopy_humidity: this._config.canopy_humidity,
      vpd_sensor: this._config.vpd_sensor,
      camera: this._config.camera,
      humidifier: this._config.humidifier,
      dehumidifier: this._config.dehumidifier,
      exhaust_fan: this._config.exhaust_fan,
      ventilation_fan: this._config.ventilation_fan,
      grow_light: this._config.grow_light,
      // Power sensors
      humidifier_power: this._config.humidifier_power,
      dehumidifier_power: this._config.dehumidifier_power,
      exhaust_fan_power: this._config.exhaust_fan_power,
      ventilation_fan_power: this._config.ventilation_fan_power,
      grow_light_power: this._config.grow_light_power
    };

    // Get current values
    var currentValues = {
      temperature: this._getEntityValue(entities.canopy_temperature),
      humidity: this._getEntityValue(entities.canopy_humidity),
      vpd: this._getEntityValue(entities.vpd_sensor),
      // Device states
      humidifier: this._getEntityValue(entities.humidifier),
      dehumidifier: this._getEntityValue(entities.dehumidifier),
      exhaust_fan: this._getEntityValue(entities.exhaust_fan),
      ventilation_fan: this._getEntityValue(entities.ventilation_fan),
      grow_light: this._getEntityValue(entities.grow_light),
      // Power values
      humidifier_power: this._getEntityValue(entities.humidifier_power),
      dehumidifier_power: this._getEntityValue(entities.dehumidifier_power),
      exhaust_fan_power: this._getEntityValue(entities.exhaust_fan_power),
      ventilation_fan_power: this._getEntityValue(entities.ventilation_fan_power),
      grow_light_power: this._getEntityValue(entities.grow_light_power)
    };
    var deviceRenderContext = {
      entities: entities,
      currentValues: currentValues
    };

    // Check if entities are configured
    var hasCamera = entities.camera && this._cameraImage;
    var hasTemperature = entities.canopy_temperature && currentValues.temperature !== null;
    var hasHumidity = entities.canopy_humidity && currentValues.humidity !== null;
    var hasVPD = entities.vpd_sensor && currentValues.vpd !== null;

    // Build the HTML
    var htmlContent = `${PANEL_STYLES}

      <h1>Growhelper</h1>
      ${this._errorMessage ? `<div class="error-banner">${this._escapeHtml(this._errorMessage)}</div>` : ''}

      <!-- Growth Phase Indicator -->
      <div class="growth-phase">
        <span>🌱</span>
        ${this._renderGrowthPhaseControl()}
      </div>

      <!-- Camera Section -->
      <section data-section="camera">
        <h2>📹 Kamera</h2>
        <div class="card">${this._renderCameraSection(hasCamera)}</div>
      </section>

      <!-- Environment Section -->
      <section data-section="environment">
        <h2>🌡️ Umgebung</h2>
        <div class="card">${this._renderEnvironmentSection(hasTemperature, hasHumidity, currentValues)}</div>
      </section>

      <!-- VPD Section -->
      <section data-section="vpd">
        <h2>💧 VPD (Dampfdruckdefizit)</h2>
        <div class="card">${this._renderVpdSection(hasVPD, currentValues.vpd)}</div>
      </section>

      <!-- Climate Section -->
      <section data-section="climate">
        <h2>🌬️ Klima-Geräte</h2>
        <div class="card">${this._renderClimateSection(deviceRenderContext)}</div>
      </section>

      <!-- Light Schedule Section -->
      <section data-section="light">
        <h2>💡 Licht-Steuerung</h2>
        <div class="card">${this._renderLightSection(deviceRenderContext)}</div>
      </section>

      <!-- Plants Section (Issue #9) -->
      <section data-section="plants">
        <h2>🌱 Pflanzen</h2>
        <div class="card">${this._renderPlantsSection()}</div>
      </section>

      <!-- Diary Section (Issue #10) -->
      <section data-section="diary">
        <h2>📖 Tagebuch</h2>
        <div class="card">${this._renderDiarySection()}</div>
      </section>
    `;

    this.shadowRoot.innerHTML = htmlContent;
  }
};
