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

// VPD reference zone bands (kPa) - from the PRD
var VPD_ZONES = {
  'under-transpiration': { max: 0.4, label: 'Unter-Transpiration', color: '#ff0000' },
  'early-veg': { min: 0.4, max: 0.8, label: 'Frühe Vegetationsphase', color: '#ffa500' },
  'late-veg': { min: 0.8, max: 1.2, label: 'Späte Vegetationsphase', color: '#ffff00' },
  'mid-late-flower': { min: 1.2, max: 1.6, label: 'Mittlere bis späte Blüte', color: '#00ff00' },
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
var DIARY_ENTRY_ALL_TAG = 'all';

// Static styles for the dashboard rendered in the shadow root.
var PANEL_STYLES = `<style>
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
      </style>`;

/** Displays a Grow Box dashboard using the current Home Assistant state. */
var GrowhelperPanel = class extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._entityStates = {};
    this._growthPhase = 'off';
    this._targetProfile = {};
    this._cameraImage = '';
    this._activeGrowRun = '';
    this._diaryRunName = '';
    this._plants = [];
    this._diaryContent = '';
    this._showEntryForm = false;
    this._entryFormData = {
      note: '',
      plant_tag: DIARY_ENTRY_ALL_TAG,
      event_title: '',
      date: this._formatDateForInput(new Date())
    };
    this._hass = {};
  }

  // Setter for hass - called by Home Assistant when hass is available
  set hass(hass) {
    this._hass = hass;
    this._loadConfigFromHass();
    this._render();
  }

  connectedCallback() {
    this._loadConfig();
    this._loadEntityStates();
    this._render();
    this._setupEventListeners();
  }

  disconnectedCallback() {
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
      // Store bound references for proper removal
      this._boundHandleFormChange = this._handleFormChange.bind(this);
      this._boundHandleClick = this._handleClick.bind(this);
      shadowRoot.addEventListener('change', this._boundHandleFormChange);
      shadowRoot.addEventListener('click', this._boundHandleClick);
    }
  }

  _cleanupEventListeners() {
    // Remove global reference
    if (window.growhelperPanel === this) {
      delete window.growhelperPanel;
    }

    // Remove event listeners
    var shadowRoot = this.shadowRoot;
    if (shadowRoot && this._boundHandleFormChange && this._boundHandleClick) {
      shadowRoot.removeEventListener('change', this._boundHandleFormChange);
      shadowRoot.removeEventListener('click', this._boundHandleClick);
      this._boundHandleFormChange = null;
      this._boundHandleClick = null;
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

  /** Dispatch a dashboard button action to the matching interaction handler. */
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
    if (this._hass && this._hass.states) {
      this._loadConfigFromHass();
    }
  }

  /** Load config and state in dependency order so phase targets match live helpers. */
  _loadConfigFromHass() {
    if (!this._hass || !this._hass.states) return;

    // Get the growhelper config from hass.states
    // Config entries are not available in frontend via hass.config.entries
    // Instead, we need to load config from the growhelper integration's state
    // For now, try to get config from hass.states['sensor.growhelper_config'] or similar
    // This is a placeholder - actual config loading needs backend support

    // Try to find config in states (if integration provides it)
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
  }

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
  }

  _loadActiveGrowRun() {
    this._activeGrowRun = this._config.active_grow_run || '';
  }

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
  }

  /** Fetch the active run's Markdown file so the dashboard shows its source-of-truth diary. */
  _loadDiaryContent() {
    if (!this._activeGrowRun) {
      this._diaryRunName = '';
      this._diaryContent = '';
      return;
    }

    if (this._diaryRunName === this._activeGrowRun || !this._hass.callService) {
      return;
    }

    var requestedRunName = this._activeGrowRun;
    this._diaryRunName = requestedRunName;
    try {
      this._hass.callService(
        'growhelper',
        'get_diary_content',
        {},
        undefined,
        true,
        true
      ).then((response) => {
        if (this._activeGrowRun !== requestedRunName) {
          return;
        }

        var diaryResponse = response.response || response;
        this._activeGrowRun = diaryResponse.run_name || '';
        this._diaryRunName = this._activeGrowRun;
        this._diaryContent = diaryResponse.content || '';
        this._render();
      }).catch((error) => {
        if (this._activeGrowRun !== requestedRunName) {
          return;
        }

        this._diaryRunName = '';
        this._diaryContent = '';
        console.error('Error loading Grow Diary:', error);
        this._render();
      });
    } catch (error) {
      this._diaryRunName = '';
      console.error('Error loading Grow Diary:', error);
    }
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

    // Format the entry first (before resetting _entryFormData)
    var newEntry = this._formatDiaryEntry(this._entryFormData);

    this._callHassService('growhelper', 'add_diary_entry', {
      note: this._entryFormData.note,
      plant_tag: this._entryFormData.plant_tag,
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
    if (this._diaryContent) {
      this._diaryContent += '\n' + newEntry;
    } else {
      this._diaryContent = newEntry;
    }

    this._render();
  }

  _formatDiaryEntry(formData) {
    // Format a diary entry according to ADR-0001
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

  /** Start a Grow Run and render the run and diary returned by Home Assistant. */
  _startNewGrowRun() {
    var serviceResponse = this._callHassService('growhelper', 'start_grow_run', {}, true);
    if (!serviceResponse || typeof serviceResponse.then !== 'function') {
      return;
    }

    serviceResponse.then((response) => {
      var startResponse = response.response || response;
      if (!startResponse || !startResponse.run_name) {
        return;
      }

      this._activeGrowRun = startResponse.run_name;
      this._diaryRunName = '';
      this._diaryContent = '';
      this._growthPhase = 'early-veg';
      this._loadTargetProfile();
      this._loadDiaryContent();
      this._render();
    }).catch((error) => {
      console.error('Error starting Grow Run:', error);
    });
  }

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
      }
    } else {
      console.log('Service call (simulated):', domain, service, serviceData);
    }
  }

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

      htmlContent += '</div></div>';
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
  }

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

    // Wrap lists in <ul> (fixed: avoid broken HTML)
    // Collect all list items and wrap them in a single <ul>
    var hasListItems = safeContent.includes('<li>');
    if (hasListItems) {
      // Replace all list items with a single <ul> wrapper
      safeContent = safeContent.replace(/<li>/g, '<li>').replace(/<\/li>/g, '</li>');
      safeContent = safeContent.replace(/((?:<li>.*?<\/li>\s*)+)/g, '<ul>$1</ul>');
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

  _getGrowthPhase() {
    // Find the active Growth Phase through its configured input helper.
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

  _safeParseFloat(value) {
    // Safely parse float, return null for invalid values (unavailable, unknown, etc.)
    if (value === null || value === undefined || value === 'unavailable' || value === 'unknown') {
      return null;
    }
    var num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  _formatNumber(value, decimals) {
    if (value === null || value === undefined) return '--';
    var num = this._safeParseFloat(value);
    return num === null ? '--' : num.toFixed(decimals || 1);
  }

  /** Return the German label corresponding to the active Growth Phase key. */
  _getGrowthPhaseLabel() {
    var labels = {
      'early-veg': 'Frühe Vegetationsphase',
      'late-veg': 'Späte Vegetationsphase',
      'late-bloom': 'Späte Blüte',
      dry: 'Trocknung',
      off: 'Aus'
    };
    return labels[this._growthPhase] || labels.off;
  }

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
  }

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
  }

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
  }

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
  }

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
  }

  /** Render a climate device and its optional power reading. */
  _renderDeviceCard(icon, name, state, power) {
    var isOn = state === 'on';
    var powerMarkup = power === null || power === undefined || power === '' ? '' :
      `<div class="device-power">${this._escapeHtml(power)} W</div>`;
    return `<div class="device-card">
      <div class="device-icon">${icon}</div>
      <div class="device-name">${name}</div>
      <div class="device-state ${isOn ? 'on' : 'off'}">${isOn ? 'EIN' : 'AUS'}</div>
      ${powerMarkup}
    </div>`;
  }

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
      this._renderDeviceCard(icon, name, currentValues[key], currentValues[powerKey])
    ).join('')}</div>`;
  }

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
      <div class="light-state ${isOn ? 'on' : 'off'}">${isOn ? 'EINGESCHALTET' : 'AUSGESCHALTET'}</div>
    </div>${powerMarkup}`;
  }

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

      <!-- Growth Phase Indicator -->
      <div class="growth-phase">
        <span>🌱</span>
        <span>${this._getGrowthPhaseLabel()}</span>
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

customElements.define('growhelper-panel', GrowhelperPanel);
