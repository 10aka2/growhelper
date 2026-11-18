/**
 * Growhelper panel web component (entry point).
 *
 * The panel is split by responsibility into src/panel/ modules (issue #32):
 * constants, styles, format helpers, state loading, actions and rendering.
 * The modules export method bags which are assigned onto the panel prototype
 * below, so the class stays the single composition root and esbuild still
 * bundles everything into one served file.
 */
import { DIARY_ENTRY_ALL_TAG } from './panel/constants.js';
import { formatMethods } from './panel/format.js';
import { stateMethods } from './panel/state.js';
import { actionMethods } from './panel/actions.js';
import { renderMethods } from './panel/render.js';

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
    this._diaryDiscoveryDone = false;
    this._diaryDiscoveryInFlight = false;
    this._errorMessage = '';
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

  /** Custom element lifecycle: load config/state, render once, attach delegated listeners. */
  connectedCallback() {
    this._loadConfig();
    this._loadEntityStates();
    this._render();
    this._setupEventListeners();
  }

  /** Custom element lifecycle: detach the delegated listeners to avoid leaks. */
  disconnectedCallback() {
    this._cleanupEventListeners();
  }

  /** Attach event delegation (change + click) on the shadow root; bound refs are kept for removal. */
  _setupEventListeners() {
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

  /** Remove the delegated listeners attached in _setupEventListeners. */
  _cleanupEventListeners() {
    // Remove event listeners
    var shadowRoot = this.shadowRoot;
    if (shadowRoot && this._boundHandleFormChange && this._boundHandleClick) {
      shadowRoot.removeEventListener('change', this._boundHandleFormChange);
      shadowRoot.removeEventListener('click', this._boundHandleClick);
      this._boundHandleFormChange = null;
      this._boundHandleClick = null;
    }
  }
};

Object.assign(
  GrowhelperPanel.prototype,
  formatMethods,
  stateMethods,
  actionMethods,
  renderMethods,
);

customElements.define('growhelper-panel', GrowhelperPanel);
