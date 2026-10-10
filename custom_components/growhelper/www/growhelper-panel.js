/**
 * Growhelper Panel - Box Sections (Camera, Environment, VPD, Climate, Plants, Diary)
 * 
 * Issue #8: Panel: box sections (camera, environment, VPD, climate)
 * Issue #9: Panel: Plants section
 * Issue #10: Panel: Grow Diary UI
 * 
 * This web component renders the Grow Box panel with:
 * - Live camera view with configured rotation
 * - Environment section (canopy temperature, humidity with threshold lines)
 * - VPD section with current value, target range, and reference zone bands
 * - Climate devices (exhaust fan, ventilation fan, humidifier, dehumidifier) with on/off state and power
 * - Light schedule with on/off times and state
 * - Plants section with soil sensor cards showing temperature, moisture, illuminance, and conductivity
 * - Grow Diary section with markdown rendering, entry form, and new run button
 */

// Use the global LitElement from Home Assistant's frontend
// Home Assistant already loads Lit, so we can use the global constructor
var LitElement = window.LitElement || window.customElements.get('ha-card')?.constructor?.superclass;

// If LitElement is not available, try to load it from HA's resources
if (!LitElement) {
  try {
    LitElement = customElements.get('ha-card').constructor;
  } catch (e) {
    console.error('LitElement not found, trying fallback...');
  }
}

// VPD reference zone bands (kPa) - from the PRD
var VPD_ZONES = {
  'under-transpiration': { max: 0.4, label: 'Unter-Transpiration', color: '#ff0000' },
  'early-veg': { min: 0.4, max: 0.8, label: 'Early Veg', color: '#ffa500' },
  'late-veg': { min: 0.8, max: 1.2, label: 'Late Veg', color: '#ffff00' },
  'mid-late-flower': { min: 1.2, max: 1.6, label: 'Mid-Late Flower', color: '#00ff00' },
  'danger-zone': { min: 1.6, label: 'Gefahrenzone', color: '#ff00ff' }
};

// Camera rotation styles
var CAMERA_ROTATION_STYLES = {
  '0': 'rotate(0deg)',
  '90': 'rotate(90deg)',
  '180': 'rotate(180deg)',
  '270': 'rotate(270deg)'
};

// Soil sensor field names for Plants
var SOIL_SENSOR_FIELDS = ['soil_temperature', 'soil_moisture', 'soil_illuminance', 'soil_conductivity'];

// Maximum number of Plants
var MAX_PLANTS = 3;

// Soil sensor display names and units
var SOIL_SENSOR_DISPLAY = {
  'soil_temperature': { label: 'Bodentemperatur', unit: '°C', icon: '🌡️' },
  'soil_moisture': { label: 'Bodenfeuchtigkeit', unit: '%', icon: '💧' },
  'soil_illuminance': { label: 'Bodenbeleuchtung', unit: 'lux', icon: '☀️' },
  'soil_conductivity': { label: 'Bodenleitfähigkeit', unit: 'mS/cm', icon: '⚡' }
};

// Grow Diary constants
var DIARY_ENTRY_ALL_TAG = 'alle';
var DIARY_DATE_FORMAT = 'DD.MM.YYYY';

// Simple template tag for HTML
var html = function(strings, ...values) {
  var result = strings[0];
  for (var i = 0; i < values.length; i++) {
    result += String(values[i]) + strings[i + 1];
  }
  return result;
};

// Simple CSS tag
var css = function(strings, ...values) {
  var result = strings[0];
  for (var i = 0; i < values.length; i++) {
    result += String(values[i]) + strings[i + 1];
  }
  return result;
};

// Growhelper Panel Class
var GrowhelperPanel = class extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._entityStates = {};
    this._historyData = {};
    this._growthPhase = 'off';
    this._targetProfile = {};
    this._cameraImage = '';
    this._activeGrowRun = '';
    this._plants = [];
    this._diaryContent = '';
    this._showEntryForm = false;
    this._entryFormData = {
      note: '',
      plant_tag: DIARY_ENTRY_ALL_TAG,
      event_title: '',
      date: this._formatDateForInput(new Date())
    };
    this._hass = window.hass || {};
  }

  connectedCallback() {
    this._loadConfig();
    this._loadEntityStates();
    this._setupHassConnection();
    this._render();
    this._setupEventListeners();
  }

  disconnectedCallback() {
    this._cleanupHassConnection();
    this._cleanupEventListeners();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    this._render();
  }

  _setupEventListeners() {
    // Set global reference for event handlers
    window.growhelperPanel = this;
    
    // Set up event delegation for form inputs
    var shadowRoot = this.shadowRoot;
    if (shadowRoot) {
      shadowRoot.addEventListener('change', this._handleFormChange.bind(this));
      shadowRoot.addEventListener('click', this._handleClick.bind(this));
    }
  }

  _cleanupEventListeners() {
    // Remove global reference
    if (window.growhelperPanel === this) {
      delete window.growhelperPanel;
    }
    
    // Remove event listeners
    var shadowRoot = this.shadowRoot;
    if (shadowRoot) {
      shadowRoot.removeEventListener('change', this._handleFormChange.bind(this));
      shadowRoot.removeEventListener('click', this._handleClick.bind(this));
    }
  }

  _handleFormChange(event) {
    // Handle form input changes via event delegation
    var target = event.target;
    var field = null;
    var value = target.value;
    
    // Check if the target has a data-field attribute
    if (target.classList.contains('diary-input')) {
      field = target.getAttribute('data-field');
    }
    
    if (field) {
      this._updateFormField(field, value);
      this._render();
    }
  }

  _handleClick(event) {
    // Handle button clicks via event delegation
    var target = event.target;
    
    // Check if the click was on a button with specific data attributes
    while (target && target !== this.shadowRoot) {
      if (target.classList.contains('btn-primary') || target.classList.contains('btn-secondary')) {
        var action = target.getAttribute('data-action');
        if (action) {
          this._handleButtonAction(action);
          event.preventDefault();
          event.stopPropagation();
          return;
        }
      }
      target = target.parentElement;
    }
  }

  _handleButtonAction(action) {
    switch (action) {
      case 'toggle-entry-form':
        this._toggleEntryForm();
        break;
      case 'submit-entry':
        this._submitDiaryEntry();
        break;
      case 'start-new-run':
        this._startNewGrowRun();
        break;
    }
  }

  _loadConfig() {
    if (window.hass) {
      this._hass = window.hass;
      this._loadConfigFromHass();
    }
  }

  _loadConfigFromHass() {
    if (!this._hass || !this._hass.states) return;
    
    // Get the growhelper config entry
    var configEntry = this._hass.config.entries ? 
      this._hass.config.entries.find(function(e) { return e.domain === 'growhelper'; }) : null;
    
    if (configEntry) {
      this._config = configEntry.options || {};
      this._loadTargetProfile();
      this._loadActiveGrowRun();
      this._loadPlants();
      this._loadDiaryContent();
    }
  }

  _loadTargetProfile() {
    // Load target profile for the current growth phase
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
  }

  _loadActiveGrowRun() {
    this._activeGrowRun = this._config.active_grow_run || '';
  }

  _loadPlants() {
    // Load plant configurations from config
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
  }

  _loadDiaryContent() {
    // Load diary content for the active grow run
    // For now, we'll use a placeholder since loading file content from the browser
    // requires a service call or API endpoint
    // In a real implementation, this would call growhelper.get_diary_content service
    
    if (!this._activeGrowRun) {
      this._diaryContent = '';
      return;
    }
    
    // Placeholder: show a sample diary content
    // In production, this would be loaded from the actual diary file
    this._diaryContent = this._getSampleDiaryContent();
  }

  _getSampleDiaryContent() {
    // Return sample diary content for demonstration
    // In a real implementation, this would be loaded from the diary file
    return '## 10.10.2026\n\n#### Bewässerung\n\n- [alle] Pflanzen bewässert\n\n---\n\n## 11.10.2026\n\n#### Düngung\n\n- [Pflanze 1] Dünger hinzugefügt\n\n---\n';
  }

  _formatDateForInput(date) {
    // Format date for input[type="date"] (YYYY-MM-DD)
    if (!date) {
      date = new Date();
    }
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  _formatDateForDisplay(dateStr) {
    // Format date for display (DD.MM.YYYY)
    if (!dateStr) return '';
    var date = new Date(dateStr);
    var day = String(date.getDate()).padStart(2, '0');
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var year = date.getFullYear();
    return day + '.' + month + '.' + year;
  }

  _getPlantTagOptions() {
    // Get plant tag options: configured plants + "alle"
    var options = [{ value: DIARY_ENTRY_ALL_TAG, label: 'Alle Pflanzen' }];
    
    for (var i = 0; i < this._plants.length; i++) {
      var plant = this._plants[i];
      options.push({ value: plant.name, label: plant.name });
    }
    
    return options;
  }

  _toggleEntryForm() {
    this._showEntryForm = !this._showEntryForm;
    // Reset form when closing
    if (!this._showEntryForm) {
      this._entryFormData = {
        note: '',
        plant_tag: DIARY_ENTRY_ALL_TAG,
        event_title: '',
        date: this._formatDateForInput(new Date())
      };
    }
    this._render();
  }

  _updateFormField(field, value) {
    this._entryFormData[field] = value;
  }

  _submitDiaryEntry() {
    // Submit the diary entry via service call
    if (!this._entryFormData.note.trim()) {
      return; // Don't submit empty notes
    }
    
    // Call the add_diary_entry service
    // For now, we'll just log and simulate the behavior
    console.log('Submitting diary entry:', this._entryFormData);
    
    // Simulate service call - in production, this would call the actual service
    this._callHassService('growhelper/add_diary_entry', {
      note: this._entryFormData.note,
      plant_tag: this._entryFormData.plant_tag === DIARY_ENTRY_ALL_TAG ? 'all' : this._entryFormData.plant_tag,
      event_title: this._entryFormData.event_title || undefined,
      date: this._entryFormData.date || undefined
    });
    
    // Reset form and reload diary
    this._entryFormData = {
      note: '',
      plant_tag: DIARY_ENTRY_ALL_TAG,
      event_title: '',
      date: this._formatDateForInput(new Date())
    };
    this._showEntryForm = false;
    
    // Add the entry to the sample content (for demo purposes)
    var newEntry = this._formatDiaryEntry(this._entryFormData);
    if (this._diaryContent) {
      this._diaryContent += '\n' + newEntry;
    } else {
      this._diaryContent = newEntry;
    }
    
    this._render();
  }

  _formatDiaryEntry(formData) {
    // Format a diary entry according to ADR-0001
    var date = new Date(formData.date);
    var dateStr = this._formatDateForDisplay(formData.date);
    var dateHeader = '## ' + dateStr;
    
    var entry = dateHeader + '\n\n';
    
    if (formData.event_title) {
      entry += '#### ' + formData.event_title + '\n\n';
    }
    
    entry += '- [' + formData.plant_tag + '] ' + formData.note + '\n';
    entry += '---\n';
    
    return entry;
  }

  _startNewGrowRun() {
    // Start a new grow run via service call
    console.log('Starting new grow run');
    
    // Call the start_grow_run service
    this._callHassService('growhelper/start_grow_run', {});
    
    // Simulate the behavior - in production, this would reload from the service response
    // For demo purposes, we'll create a new run name and reset the diary
    var newRunName = 'grow_run_' + new Date().toISOString().substr(0, 10).replace(/-/g, '');
    this._activeGrowRun = newRunName;
    this._diaryContent = this._getSampleDiaryContent();
    this._growthPhase = 'early-veg';
    
    this._render();
  }

  _callHassService(domain, serviceData) {
    // Call a Home Assistant service
    // In Home Assistant, services are called via hass.callService
    if (this._hass && this._hass.callService) {
      try {
        this._hass.callService(domain, serviceData);
      } catch (error) {
        console.error('Error calling service:', domain, error);
      }
    } else {
      console.log('Service call (simulated):', domain, serviceData);
    }
  }

  _renderPlantsSection() {
    // Check if there are any plants configured
    if (!this._plants || this._plants.length === 0) {
      return '<p class="empty">Keine Pflanzen konfiguriert.</p>';
    }
    
    var htmlContent = '<div class="plants-grid">';
    
    for (var i = 0; i < this._plants.length; i++) {
      var plant = this._plants[i];
      var plantId = 'plant-' + (i + 1);
      
      htmlContent += '
        <div class="plant-card" data-plant-id="' + plantId + '">
          <div class="plant-header">
            <span class="plant-name">' + this._escapeHtml(plant.name) + '</span>';
      
      if (plant.cultivar) {
        htmlContent += '
            <span class="plant-cultivar">' + this._escapeHtml(plant.cultivar) + '</span>';
      }
      
      htmlContent += '
          </div>
          <div class="plant-sensors">';
      
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
        
        htmlContent += '
            <div class="plant-sensor-card ' + (hasSensor ? 'has-value' : 'empty') + '">
              <div class="sensor-icon">' + sensorInfo.icon + '</div>
              <div class="sensor-label">' + sensorInfo.label + '</div>
              <div class="sensor-value">';
        
        if (hasSensor) {
          htmlContent += this._formatNumber(sensorValue, 1) + ' <span class="sensor-unit">' + sensorInfo.unit + '</span>';
        } else {
          htmlContent += '<span class="sensor-unavailable">––</span>';
        }
        
        htmlContent += '
              </div>
              <div class="sensor-chart">
                <div class="chart-placeholder">' + sensorInfo.label + '-Verlauf (24h)</div>
              </div>
            </div>';
      }
      
      htmlContent += '
          </div>
        </div>';
    }
    
    htmlContent += '</div>';
    
    return htmlContent;
  }

  _escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  _renderDiarySection() {
    var htmlContent = '';
    
    // Show active grow run info
    if (this._activeGrowRun) {
      htmlContent += '
        <div class="diary-header">
          <span class="active-run-info">
            <strong>Aktive Grow Run:</strong> ' + this._escapeHtml(this._activeGrowRun) + '
          </span>
          <button class="btn btn-primary" data-action="start-new-run">
            🆕 Neue Grow Run starten
          </button>
        </div>';
    } else {
      htmlContent += '
        <div class="diary-header">
          <p class="empty">Keine aktive Grow Run. Starte eine neue, um Einträge hinzuzufügen.</p>
          <button class="btn btn-primary" data-action="start-new-run">
            🆕 Neue Grow Run starten
          </button>
        </div>';
    }
    
    // Show diary content
    if (this._diaryContent) {
      htmlContent += '
        <div class="diary-content markdown-body">
          ' + this._renderMarkdown(this._diaryContent) + '
        </div>';
    } else if (this._activeGrowRun) {
      htmlContent += '
        <div class="diary-content empty">
          <p>Keine Einträge für diese Grow Run.</p>
        </div>';
    }
    
    // Entry form
    htmlContent += '
      <div class="diary-entry-form">
        <button class="btn btn-secondary" data-action="toggle-entry-form">
          ' + (this._showEntryForm ? '❌ Abbrechen' : '➕ Neuer Eintrag') + '
        </button>
        
        ' + (this._showEntryForm ? this._renderEntryForm() : '') + '
      </div>';
    
    // Set global reference for event handlers
    htmlContent += '<script>
      (function() {
        var panel = document.currentScript.closest("growhelper-panel");
        if (panel) {
          window.growhelperPanel = panel;
        }
      })();
    </script>';
    
    // Set global reference to this panel instance for event handlers
    htmlContent += '<script>
      (function() {
        var panel = document.currentScript.closest("growhelper-panel");
        if (panel) {
          window.growhelperPanel = panel;
        }
      })();
    </script>';
    
    return htmlContent;
  }

  _renderEntryForm() {
    var plantOptions = this._getPlantTagOptions();
    var optionsHtml = '';
    
    for (var i = 0; i < plantOptions.length; i++) {
      var option = plantOptions[i];
      var selected = option.value === this._entryFormData.plant_tag ? 'selected' : '';
      optionsHtml += '<option value="' + this._escapeHtml(option.value) + '" ' + selected + '>' + this._escapeHtml(option.label) + '</option>';
    }
    
    return '
      <div class="entry-form-container">
        <div class="form-group">
          <label>Datum:</label>
          <input 
            type="date" 
            class="diary-input" 
            data-field="date"
            value="' + this._entryFormData.date + '"
          >
        </div>
        
        <div class="form-group">
          <label>Ereignis (optional):</label>
          <input 
            type="text" 
            class="diary-input" 
            data-field="event_title"
            value="' + this._escapeHtml(this._entryFormData.event_title) + '"
            placeholder="z.B. Bewässerung, Düngung"
          >
        </div>
        
        <div class="form-group">
          <label>Pflanze:</label>
          <select 
            class="diary-input" 
            data-field="plant_tag"
          >
            ' + optionsHtml + '
          </select>
        </div>
        
        <div class="form-group">
          <label>Notiz:</label>
          <textarea 
            class="diary-input" 
            data-field="note"
            placeholder="Was ist passiert?"
            rows="3"
          >' + this._escapeHtml(this._entryFormData.note) + '</textarea>
        </div>
        
        <div class="form-actions">
          <button class="btn btn-primary" data-action="submit-entry">
            ✅ Eintrag hinzufügen
          </button>
        </div>
      </div>';
  }

  _renderMarkdown(content) {
    // Simple markdown rendering for the diary
    // In a real implementation, we'd use a proper markdown library
    // For now, we'll do basic formatting
    
    if (!content) return '<p class="empty">Kein Inhalt</p>';
    
    // Escape HTML first
    var safeContent = this._escapeHtml(content);
    
    // Basic markdown formatting
    // Headers: ## Date -> <h3>Date</h3>
    safeContent = safeContent.replace(/^##\s+(.+)$/gm, '<h3>$1</h3>');
    safeContent = safeContent.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
    
    // Separator: --- -> <hr>
    safeContent = safeContent.replace(/^---$/gm, '<hr>');
    
    // Bullet points: - [tag] text -> <li>[tag] text</li>
    safeContent = safeContent.replace(/^-\s+\[([^\]]+)\]\s+(.+)$/gm, '<li><strong>[$1]</strong> $2</li>');
    
    // Wrap lists in <ul>
    safeContent = safeContent.replace(/<li>/g, '</ul><ul><li>');
    safeContent = safeContent.replace(/<\/li>/g, '</li>');
    if (safeContent.includes('<ul>')) {
      safeContent = '<ul>' + safeContent + '</ul>';
    }
    
    // Remove empty <ul> tags
    safeContent = safeContent.replace(/<ul><\/ul>/g, '');
    
    // Add paragraph tags for standalone text
    safeContent = safeContent.replace(/^([^<].+)$/gm, '<p>$1</p>');
    
    return safeContent;
  }

  _loadEntityStates() {
    if (!this._hass || !this._hass.states) return;
    
    // Load all entity states
    this._entityStates = {};
    Object.keys(this._hass.states).forEach(function(entityId) {
      this._entityStates[entityId] = this._hass.states[entityId];
    }.bind(this));
    
    // Load camera image
    this._loadCameraImage();
  }

  _setupHassConnection() {
    if (!window.hass) return;
    
    // Listen for state changes
    if (window.hass.connection) {
      window.hass.connection.subscribeStates(this._handleStateChange.bind(this));
    }
    
    // Listen for config changes
    if (window.hass.connection) {
      window.hass.connection.subscribeConfig(this._handleConfigChange.bind(this));
    }
  }

  _cleanupHassConnection() {
    if (window.hass?.connection) {
      try {
        window.hass.connection.unsubscribeStates(this._handleStateChange.bind(this));
        window.hass.connection.unsubscribeConfig(this._handleConfigChange.bind(this));
      } catch (e) {
        // Ignore unsubscribe errors
      }
    }
  }

  _handleStateChange() {
    this._loadEntityStates();
    this._render();
  }

  _handleConfigChange() {
    this._loadConfigFromHass();
    this._render();
  }

  _loadCameraImage() {
    if (!this._config.camera) return;
    
    var cameraEntity = this._entityStates[this._config.camera];
    if (cameraEntity && cameraEntity.attributes && cameraEntity.attributes.entity_picture) {
      this._cameraImage = cameraEntity.attributes.entity_picture;
    } else {
      this._cameraImage = '';
    }
  }

  _getEntityState(entityId) {
    return this._entityStates[entityId];
  }

  _getEntityValue(entityId) {
    var state = this._getEntityState(entityId);
    return state ? state.state : null;
  }

  _getEntityAttribute(entityId, attribute) {
    var state = this._getEntityState(entityId);
    return state ? state.attributes && state.attributes[attribute] : null;
  }

  _getGrowthPhase() {
    // Check which growth phase boolean is on
    var phases = ['early-veg', 'late-veg', 'late-bloom', 'dry', 'off'];
    for (var i = 0; i < phases.length; i++) {
      var phase = phases[i];
      var entityKey = 'growth_phase_' + phase.replace(/-/g, '_');
      var entityId = this._config[entityKey];
      if (entityId && this._getEntityValue(entityId) === 'on') {
        return phase;
      }
    }
    return 'off';
  }

  _getCameraRotationStyle() {
    var rotation = this._config.camera_rotation || '0';
    return CAMERA_ROTATION_STYLES[rotation] || 'rotate(0deg)';
  }

  _isInRange(value, min, max) {
    if (value === null || value === undefined) return null;
    if (min === null || max === null) return null;
    return value >= min && value <= max;
  }

  _formatNumber(value, decimals) {
    if (value === null || value === undefined) return '--';
    return parseFloat(value).toFixed(decimals || 1);
  }

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

    // Check if entities are configured
    var hasCamera = entities.camera && this._cameraImage;
    var hasTemperature = entities.canopy_temperature && currentValues.temperature !== null;
    var hasHumidity = entities.canopy_humidity && currentValues.humidity !== null;
    var hasVPD = entities.vpd_sensor && currentValues.vpd !== null;
    var hasDevices = entities.humidifier || entities.dehumidifier || entities.exhaust_fan || entities.ventilation_fan || entities.grow_light;

    // Build the HTML
    var htmlContent = '
      <style>
        :host {
          display: block;
          padding: 16px;
          max-width: 1200px;
          margin: 0 auto;
          font-family: var(--ha-font-family, sans-serif);
        }
        
        h1 {
          font-size: 24px;
          margin: 0 0 16px;
          color: var(--primary-text-color, #212121);
        }
        
        section {
          margin-bottom: 24px;
          background: var(--card-background-color, #ffffff);
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        
        h2 {
          font-size: 18px;
          margin: 0;
          padding: 16px 16px 8px;
          color: var(--primary-text-color, #212121);
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
        }
        
        .card {
          padding: 16px;
        }
        
        .empty {
          color: var(--secondary-text-color, #727272);
          font-style: italic;
          padding: 8px 0;
        }
        
        /* Growth Phase */
        .growth-phase {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 4px 12px;
          background: var(--primary-color, #03A9F4);
          color: white;
          border-radius: 12px;
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 16px;
        }
        
        /* Camera Section */
        .camera-container {
          position: relative;
          overflow: hidden;
          border-radius: 4px;
        }
        
        .camera-container img {
          width: 100%;
          height: auto;
          display: block;
          transition: transform 0.3s ease;
        }
        
        .camera-rotation-info {
          font-size: 12px;
          color: var(--secondary-text-color, #727272);
          margin-top: 4px;
        }
        
        /* Environment Section */
        .environment-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }
        
        .env-card {
          background: var(--secondary-background-color, #f5f5f5);
          padding: 12px;
          border-radius: 4px;
        }
        
        .env-card .label {
          font-size: 12px;
          color: var(--secondary-text-color, #727272);
          margin-bottom: 4px;
        }
        
        .env-card .value {
          font-size: 20px;
          font-weight: bold;
          color: var(--primary-text-color, #212121);
        }
        
        .env-card .unit {
          font-size: 14px;
          color: var(--secondary-text-color, #727272);
          margin-left: 4px;
        }
        
        .threshold-indicator {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-left: 8px;
        }
        
        .threshold-indicator.in-range {
          background-color: #4CAF50;
        }
        
        .threshold-indicator.below-range {
          background-color: #FF9800;
        }
        
        .threshold-indicator.above-range {
          background-color: #F44336;
        }
        
        .chart-container {
          height: 100px;
          margin-top: 8px;
        }
        
        .chart-placeholder {
          height: 100%;
          background: var(--secondary-background-color, #f5f5f5);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--secondary-text-color, #727272);
          font-size: 12px;
        }
        
        /* VPD Section */
        .vpd-container {
          display: flex;
          gap: 24px;
          align-items: flex-start;
        }
        
        .vpd-value-display {
          flex: 0 0 200px;
        }
        
        .vpd-value {
          font-size: 32px;
          font-weight: bold;
          color: var(--primary-text-color, #212121);
        }
        
        .vpd-unit {
          font-size: 16px;
          color: var(--secondary-text-color, #727272);
        }
        
        .vpd-zones {
          flex: 1;
        }
        
        .vpd-zone {
          display: flex;
          align-items: center;
          margin-bottom: 8px;
        }
        
        .vpd-zone-color {
          width: 20px;
          height: 20px;
          border-radius: 4px;
          margin-right: 8px;
        }
        
        .vpd-zone-label {
          flex: 1;
          font-size: 14px;
        }
        
        .vpd-zone-range {
          font-size: 12px;
          color: var(--secondary-text-color, #727272);
        }
        
        .vpd-current-indicator {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 0 0 2px currentColor;
          margin-right: 4px;
        }
        
        /* Plants Section */
        .plants-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 16px;
        }
        
        .plant-card {
          background: var(--secondary-background-color, #f5f5f5);
          border-radius: 8px;
          padding: 12px;
          border: 1px solid var(--divider-color, #e0e0e0);
        }
        
        .plant-header {
          display: flex;
          flex-direction: column;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
        }
        
        .plant-name {
          font-size: 16px;
          font-weight: bold;
          color: var(--primary-text-color, #212121);
        }
        
        .plant-cultivar {
          font-size: 12px;
          color: var(--secondary-text-color, #727272);
          font-style: italic;
        }
        
        .plant-sensors {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }
        
        .plant-sensor-card {
          background: white;
          border-radius: 4px;
          padding: 8px;
          border: 1px solid var(--divider-color, #e0e0e0);
        }
        
        .plant-sensor-card.has-value {
          background: white;
        }
        
        .plant-sensor-card.empty {
          background: var(--secondary-background-color, #f5f5f5);
        }
        
        .sensor-icon {
          font-size: 16px;
          margin-bottom: 4px;
        }
        
        .sensor-label {
          font-size: 11px;
          color: var(--secondary-text-color, #727272);
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .sensor-value {
          font-size: 14px;
          font-weight: bold;
          color: var(--primary-text-color, #212121);
        }
        
        .sensor-unit {
          font-size: 11px;
          color: var(--secondary-text-color, #727272);
        }
        
        .sensor-unavailable {
          color: var(--secondary-text-color, #727272);
          font-style: italic;
        }
        
        .sensor-chart {
          height: 60px;
          margin-top: 6px;
        }
        
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 8px;
          font-size: 12px;
          margin-top: 8px;
        }
        
        .status-badge.active {
          background: #4CAF50;
          color: white;
        }
        
        .status-badge.inactive {
          background: #9E9E9E;
          color: white;
        }
        
        /* Climate Devices Section */
        .devices-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
        }
        
        .device-card {
          background: var(--secondary-background-color, #f5f5f5);
          padding: 12px;
          border-radius: 4px;
          text-align: center;
        }
        
        .device-icon {
          font-size: 24px;
          margin-bottom: 4px;
        }
        
        .device-name {
          font-size: 12px;
          color: var(--secondary-text-color, #727272);
          margin-bottom: 4px;
        }
        
        .device-state {
          font-size: 14px;
          font-weight: bold;
        }
        
        .device-state.on {
          color: #4CAF50;
        }
        
        .device-state.off {
          color: #F44336;
        }
        
        .device-power {
          font-size: 12px;
          color: var(--secondary-text-color, #727272);
          margin-top: 4px;
        }
        
        /* Light Schedule Section */
        .light-schedule {
          display: flex;
          gap: 16px;
          align-items: center;
          flex-wrap: wrap;
        }
        
        .light-time {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .light-time-icon {
          font-size: 16px;
        }
        
        .light-time-value {
          font-size: 14px;
          font-weight: bold;
        }
        
        .light-state {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
        }
        
        .light-state.on {
          background: #4CAF50;
          color: white;
        }
        
        .light-state.off {
          background: #F44336;
          color: white;
        }
        
        /* Responsive */
        @media (max-width: 600px) {
          :host {
            padding: 8px;
          }
          
          h1 {
            font-size: 20px;
          }
          
          .vpd-container {
            flex-direction: column;
          }
          
          .vpd-value-display {
            flex: none;
            text-align: center;
          }
          
          .plants-grid {
            grid-template-columns: 1fr;
          }
          
          .plant-sensors {
            grid-template-columns: 1fr;
          }
          
          .diary-header {
            flex-direction: column;
            align-items: stretch;
          }
          
          .form-actions {
            flex-direction: column;
          }
          
          .btn {
            width: 100%;
          }
        }
        
        /* Diary Section */
        .diary-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 12px;
        }
        
        .active-run-info {
          font-size: 14px;
          color: var(--secondary-text-color, #727272);
        }
        
        .diary-content {
          margin-bottom: 16px;
          padding: 12px;
          background: var(--secondary-background-color, #f5f5f5);
          border-radius: 4px;
          min-height: 100px;
        }
        
        .diary-content.empty {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--secondary-text-color, #727272);
          font-style: italic;
        }
        
        .markdown-body {
          line-height: 1.5;
        }
        
        .markdown-body h3 {
          font-size: 16px;
          margin: 16px 0 8px;
          color: var(--primary-text-color, #212121);
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
          padding-bottom: 4px;
        }
        
        .markdown-body h4 {
          font-size: 14px;
          margin: 12px 0 4px;
          color: var(--primary-text-color, #212121);
        }
        
        .markdown-body p {
          margin: 8px 0;
          color: var(--primary-text-color, #212121);
        }
        
        .markdown-body ul {
          margin: 8px 0;
          padding-left: 20px;
        }
        
        .markdown-body li {
          margin: 4px 0;
          color: var(--primary-text-color, #212121);
        }
        
        .markdown-body hr {
          border: none;
          border-top: 1px solid var(--divider-color, #e0e0e0);
          margin: 12px 0;
        }
        
        .diary-entry-form {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--divider-color, #e0e0e0);
        }
        
        .entry-form-container {
          margin-top: 12px;
          padding: 12px;
          background: var(--secondary-background-color, #f5f5f5);
          border-radius: 4px;
        }
        
        .form-group {
          margin-bottom: 12px;
        }
        
        .form-group label {
          display: block;
          font-size: 12px;
          color: var(--secondary-text-color, #727272);
          margin-bottom: 4px;
          font-weight: bold;
        }
        
        .form-group input[type="text"],
        .form-group input[type="date"],
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 8px;
          border: 1px solid var(--divider-color, #e0e0e0);
          border-radius: 4px;
          font-size: 14px;
          box-sizing: border-box;
        }
        
        .form-group textarea {
          resize: vertical;
          min-height: 80px;
        }
        
        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 16px;
        }
        
        /* Buttons */
        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }
        
        .btn-primary {
          background: var(--primary-color, #03A9F4);
          color: white;
        }
        
        .btn-primary:hover {
          background: var(--primary-color-dark, #0288D1);
        }
        
        .btn-secondary {
          background: var(--secondary-background-color, #f5f5f5);
          color: var(--primary-text-color, #212121);
          border: 1px solid var(--divider-color, #e0e0e0);
        }
        
        .btn-secondary:hover {
          background: var(--divider-color, #e0e0e0);
        }
      </style>
      
      <h1>Growhelper</h1>
      
      <!-- Growth Phase Indicator -->
      <div class="growth-phase">
        <span>🌱</span>
        <span>' + (this._growthPhase === 'off' ? 'Aus' : this._growthPhase) + '</span>
      </div>
      
      <!-- Camera Section -->
      <section data-section="camera">
        <h2>📹 Kamera</h2>
        <div class="card">
          ' + (hasCamera ? '
            <div class="camera-container">
              <img 
                src="' + this._cameraImage + '" 
                style="transform: ' + this._getCameraRotationStyle() + ';" 
                onerror="this.style.display=\'none\'; this.parentNode.innerHTML=\'<p class=\"empty\">Kamera-Bild nicht verfügbar.</p>\'"
              >
              <div class="camera-rotation-info">
                Rotation: ' + (this._config.camera_rotation || '0') + '°
              </div>
            </div>
          ' : '<p class="empty">Keine Kamera konfiguriert oder verfügbar.</p>') + '
        </div>
      </section>
      
      <!-- Environment Section -->
      <section data-section="environment">
        <h2>🌡️ Umgebung</h2>
        <div class="card">
          ' + (hasTemperature || hasHumidity ? '
            <div class="environment-grid">
              ' + (hasTemperature ? '
                <div class="env-card">
                  <div class="label">Temperatur</div>
                  <div class="value">
                    ' + this._formatNumber(currentValues.temperature, 1) + '
                    <span class="unit">°C</span>
                    ' + (this._isInRange(parseFloat(currentValues.temperature), this._targetProfile.temperature?.lower, this._targetProfile.temperature?.upper) ? '
                      <span class="threshold-indicator in-range" title="Im Zielbereich"></span>
                    ' : this._isInRange(parseFloat(currentValues.temperature), this._targetProfile.temperature?.lower, this._targetProfile.temperature?.upper) === false && currentValues.temperature < this._targetProfile.temperature?.lower ? '
                      <span class="threshold-indicator below-range" title="Unter dem Zielbereich"></span>
                    ' : '
                      <span class="threshold-indicator above-range" title="Über dem Zielbereich"></span>
                    ') + '
                  </div>
                  <div class="chart-container">
                    <div class="chart-placeholder">Temperaturverlauf (24h)</div>
                  </div>
                </div>
              ' : '') + '
              
              ' + (hasHumidity ? '
                <div class="env-card">
                  <div class="label">Luftfeuchtigkeit</div>
                  <div class="value">
                    ' + this._formatNumber(currentValues.humidity, 1) + '
                    <span class="unit">%</span>
                    ' + (this._isInRange(parseFloat(currentValues.humidity), this._targetProfile.humidity?.lower, this._targetProfile.humidity?.upper) ? '
                      <span class="threshold-indicator in-range" title="Im Zielbereich"></span>
                    ' : this._isInRange(parseFloat(currentValues.humidity), this._targetProfile.humidity?.lower, this._targetProfile.humidity?.upper) === false && currentValues.humidity < this._targetProfile.humidity?.lower ? '
                      <span class="threshold-indicator below-range" title="Unter dem Zielbereich"></span>
                    ' : '
                      <span class="threshold-indicator above-range" title="Über dem Zielbereich"></span>
                    ') + '
                  </div>
                  <div class="chart-container">
                    <div class="chart-placeholder">Luftfeuchtigkeitsverlauf (24h)</div>
                  </div>
                </div>
              ' : '') + '
            </div>
          ' : '<p class="empty">Keine Umgebungs-Sensoren konfiguriert oder verfügbar.</p>') + '
        </div>
      </section>
      
      <!-- VPD Section -->
      <section data-section="vpd">
        <h2>💧 VPD (Dampfdruckdefizit)</h2>
        <div class="card">
          ' + (hasVPD ? '
            <div class="vpd-container">
              <div class="vpd-value-display">
                <div class="vpd-value">' + this._formatNumber(currentValues.vpd, 2) + '</div>
                <div class="vpd-unit">kPa</div>
                <div class="status-badge ' + (this._isInRange(parseFloat(currentValues.vpd), this._targetProfile.vpd?.lower, this._targetProfile.vpd?.upper) ? 'active' : 'inactive') + '">
                  ' + (this._isInRange(parseFloat(currentValues.vpd), this._targetProfile.vpd?.lower, this._targetProfile.vpd?.upper) ? 'Im Zielbereich' : 'Außerhalb des Zielbereichs') + '
                </div>
              </div>
              <div class="vpd-zones">
                <div class="vpd-zone">
                  <div class="vpd-zone-color" style="background: ' + VPD_ZONES['under-transpiration'].color + ';"></div>
                  <div class="vpd-zone-label">' + VPD_ZONES['under-transpiration'].label + '</div>
                  <div class="vpd-zone-range">&lt; ' + VPD_ZONES['under-transpiration'].max + ' kPa</div>
                  ' + (parseFloat(currentValues.vpd) < VPD_ZONES['under-transpiration'].max ? '<div class="vpd-current-indicator" style="background: ' + VPD_ZONES['under-transpiration'].color + ';"></div>' : '') + '
                </div>
                <div class="vpd-zone">
                  <div class="vpd-zone-color" style="background: ' + VPD_ZONES['early-veg'].color + ';"></div>
                  <div class="vpd-zone-label">' + VPD_ZONES['early-veg'].label + '</div>
                  <div class="vpd-zone-range">' + VPD_ZONES['early-veg'].min + '–' + VPD_ZONES['early-veg'].max + ' kPa</div>
                  ' + (parseFloat(currentValues.vpd) >= VPD_ZONES['early-veg'].min && parseFloat(currentValues.vpd) <= VPD_ZONES['early-veg'].max ? '<div class="vpd-current-indicator" style="background: ' + VPD_ZONES['early-veg'].color + ';"></div>' : '') + '
                </div>
                <div class="vpd-zone">
                  <div class="vpd-zone-color" style="background: ' + VPD_ZONES['late-veg'].color + ';"></div>
                  <div class="vpd-zone-label">' + VPD_ZONES['late-veg'].label + '</div>
                  <div class="vpd-zone-range">' + VPD_ZONES['late-veg'].min + '–' + VPD_ZONES['late-veg'].max + ' kPa</div>
                  ' + (parseFloat(currentValues.vpd) >= VPD_ZONES['late-veg'].min && parseFloat(currentValues.vpd) <= VPD_ZONES['late-veg'].max ? '<div class="vpd-current-indicator" style="background: ' + VPD_ZONES['late-veg'].color + ';"></div>' : '') + '
                </div>
                <div class="vpd-zone">
                  <div class="vpd-zone-color" style="background: ' + VPD_ZONES['mid-late-flower'].color + ';"></div>
                  <div class="vpd-zone-label">' + VPD_ZONES['mid-late-flower'].label + '</div>
                  <div class="vpd-zone-range">' + VPD_ZONES['mid-late-flower'].min + '–' + VPD_ZONES['mid-late-flower'].max + ' kPa</div>
                  ' + (parseFloat(currentValues.vpd) >= VPD_ZONES['mid-late-flower'].min && parseFloat(currentValues.vpd) <= VPD_ZONES['mid-late-flower'].max ? '<div class="vpd-current-indicator" style="background: ' + VPD_ZONES['mid-late-flower'].color + ';"></div>' : '') + '
                </div>
                <div class="vpd-zone">
                  <div class="vpd-zone-color" style="background: ' + VPD_ZONES['danger-zone'].color + ';"></div>
                  <div class="vpd-zone-label">' + VPD_ZONES['danger-zone'].label + '</div>
                  <div class="vpd-zone-range">&gt; ' + VPD_ZONES['danger-zone'].min + ' kPa</div>
                  ' + (parseFloat(currentValues.vpd) >= VPD_ZONES['danger-zone'].min ? '<div class="vpd-current-indicator" style="background: ' + VPD_ZONES['danger-zone'].color + ';"></div>' : '') + '
                </div>
              </div>
            </div>
            <div class="chart-container">
              <div class="chart-placeholder">VPD-Verlauf (24h)</div>
            </div>
          ' : '<p class="empty">Kein VPD-Sensor konfiguriert oder verfügbar.</p>') + '
        </div>
      </section>
      
      <!-- Climate Section -->
      <section data-section="climate">
        <h2>🌬️ Klima-Geräte</h2>
        <div class="card">
          ' + (hasDevices ? '
            <div class="devices-grid">
              ' + (entities.humidifier ? '
                <div class="device-card">
                  <div class="device-icon">💦</div>
                  <div class="device-name">Befeuchter</div>
                  <div class="device-state ' + (currentValues.humidifier === 'on' ? 'on' : 'off') + '">
                    ' + (currentValues.humidifier === 'on' ? 'EIN' : 'AUS') + '
                  </div>
                  ' + (entities.humidifier_power && currentValues.humidifier_power ? '
                    <div class="device-power">' + currentValues.humidifier_power + ' W</div>
                  ' : '') + '
                </div>
              ' : '') + '
              
              ' + (entities.dehumidifier ? '
                <div class="device-card">
                  <div class="device-icon">🌬️</div>
                  <div class="device-name">Entfeuchter</div>
                  <div class="device-state ' + (currentValues.dehumidifier === 'on' ? 'on' : 'off') + '">
                    ' + (currentValues.dehumidifier === 'on' ? 'EIN' : 'AUS') + '
                  </div>
                  ' + (entities.dehumidifier_power && currentValues.dehumidifier_power ? '
                    <div class="device-power">' + currentValues.dehumidifier_power + ' W</div>
                  ' : '') + '
                </div>
              ' : '') + '
              
              ' + (entities.exhaust_fan ? '
                <div class="device-card">
                  <div class="device-icon">💨</div>
                  <div class="device-name">Abluft</div>
                  <div class="device-state ' + (currentValues.exhaust_fan === 'on' ? 'on' : 'off') + '">
                    ' + (currentValues.exhaust_fan === 'on' ? 'EIN' : 'AUS') + '
                  </div>
                  ' + (entities.exhaust_fan_power && currentValues.exhaust_fan_power ? '
                    <div class="device-power">' + currentValues.exhaust_fan_power + ' W</div>
                  ' : '') + '
                </div>
              ' : '') + '
              
              ' + (entities.ventilation_fan ? '
                <div class="device-card">
                  <div class="device-icon">🌀</div>
                  <div class="device-name">Belüftung</div>
                  <div class="device-state ' + (currentValues.ventilation_fan === 'on' ? 'on' : 'off') + '">
                    ' + (currentValues.ventilation_fan === 'on' ? 'EIN' : 'AUS') + '
                  </div>
                  ' + (entities.ventilation_fan_power && currentValues.ventilation_fan_power ? '
                    <div class="device-power">' + currentValues.ventilation_fan_power + ' W</div>
                  ' : '') + '
                </div>
              ' : '') + '
            </div>
          ' : '<p class="empty">Keine Klima-Geräte konfiguriert oder verfügbar.</p>') + '
        </div>
      </section>
      
      <!-- Light Schedule Section -->
      <section data-section="light">
        <h2>💡 Licht-Steuerung</h2>
        <div class="card">
          ' + (entities.grow_light ? '
            <div class="light-schedule">
              <div class="light-time">
                <span class="light-time-icon">🌅</span>
                <span class="light-time-value">' + (this._targetProfile.light?.on || '08:00') + '</span>
              </div>
              <div class="light-time">
                <span class="light-time-icon">🌇</span>
                <span class="light-time-value">' + (this._targetProfile.light?.off || '20:00') + '</span>
              </div>
              <div class="light-state ' + (currentValues.grow_light === 'on' ? 'on' : 'off') + '">
                ' + (currentValues.grow_light === 'on' ? 'EINGESCHALTET' : 'AUSGESCHALTET') + '
              </div>
            </div>
            ' + (entities.grow_light_power && currentValues.grow_light_power ? '
              <div style="margin-top: 8px; font-size: 14px; color: var(--secondary-text-color, #727272);">
                Leistung: ' + currentValues.grow_light_power + ' W
              </div>
            ' : '') + '
          ' : '<p class="empty">Keine Licht-Steuerung konfiguriert oder verfügbar.</p>') + '
        </div>
      </section>
      
      <!-- Plants Section (Issue #9) -->
      <section data-section="plants">
        <h2>🌱 Pflanzen</h2>
        <div class="card">
          ' + this._renderPlantsSection() + '
        </div>
      </section>
      
      <!-- Diary Section (Issue #10) -->
      <section data-section="diary">
        <h2>📖 Tagebuch</h2>
        <div class="card">
          ' + this._renderDiarySection() + '
        </div>
      </section>
    ';

    this.shadowRoot.innerHTML = htmlContent;
  }
};

customElements.define('growhelper-panel', GrowhelperPanel);
