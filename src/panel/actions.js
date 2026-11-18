/**
 * Event delegation and dashboard actions (device toggle, phase selector, diary, grow run).
 */
import { DIARY_ENTRY_ALL_TAG } from './constants.js';

export const actionMethods = {

  /** Handle 'change' events via delegation: diary inputs update form fields, the phase selector switches the Growth Phase (issue #29). */
  _handleFormChange(event) {
    // Handle form input changes via event delegation
    var target = event.target;
    var field = null;
    var value = target.value;

    // Check if the target has a data-field attribute
    if (target.classList.contains('diary-input')) {
      field = target.getAttribute('data-field');
    }

    // The Growth Phase selector switches the phase via its data-action.
    var changeAction = target.getAttribute ? target.getAttribute('data-action') : null;
    if (changeAction === 'set-phase') {
      this._setGrowthPhase(value);
      return;
    }

    if (field) {
      this._updateFormField(field, value);
      this._render();
    }
  },

  /** Handle 'click' events via delegation: dispatch the data-action of the nearest actionable ancestor. */
  _handleClick(event) {
    // Handle clicks via event delegation: any element carrying data-action
    // (buttons as well as toggleable device cards) dispatches its action.
    var target = event.target;

    while (target && target !== this.shadowRoot) {
      var action = target.getAttribute ? target.getAttribute('data-action') : null;
      if (action) {
        this._handleButtonAction(action, target);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      target = target.parentElement;
    }
  },

  /** Dispatch a dashboard action to the matching interaction handler. */
  _handleButtonAction(action, target) {
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
      case 'quick-entry': {
        var plantTag = target && target.getAttribute ? target.getAttribute('data-plant-tag') : null;
        if (plantTag) {
          this._openEntryFormForPlant(plantTag);
        }
        break;
      }
      case 'toggle-device': {
        var entityId = target && target.getAttribute ? target.getAttribute('data-entity-id') : null;
        if (entityId) {
          this._toggleDevice(entityId);
        }
        break;
      }
    }
  },

  /** Toggle a Grow Box device (Entity Role) via its generic HA service (issue #28).
   *
   * The domain comes from the entity id, so switch.* and light.* both work.
   * No optimistic update: the panel re-renders on the next hass update, which
   * carries the new state. A failed call (e.g. missing permission) is shown
   * in the error banner.
   */
  _toggleDevice(entityId) {
    var domain = entityId.split('.')[0];
    var service = this._getEntityValue(entityId) === 'on' ? 'turn_off' : 'turn_on';
    var call = this._callHassService(domain, service, { entity_id: entityId }, false);
    if (!call || typeof call.then !== 'function') {
      // No hass connection (e.g. simulated environment): surface it too.
      this._errorMessage = 'Gerät konnte nicht geschaltet werden: keine Home-Assistant-Verbindung';
      this._render();
      return;
    }
    call
      .then(() => {
        // Only clear errors that came from a device toggle — not e.g. a
        // failed diary submit sharing the same banner.
        if (this._errorMessage.startsWith('Gerät konnte nicht')) {
          this._errorMessage = '';
          this._render();
        }
      })
      .catch((error) => {
        this._errorMessage = 'Gerät konnte nicht geschaltet werden: ' + this._errorText(error);
        this._render();
      });
  },

  /** Show/hide the diary entry form; closing it resets the form fields. */
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
  },

  /** Open the diary entry form with a Plant's tag prefilled (quick entry from a Plant card, issue #31).
   *
   * The entry itself still goes through growhelper.add_diary_entry — the
   * append-only diary (ADR-0001) has no other write path.
   */
  _openEntryFormForPlant(plantTag) {
    this._showEntryForm = true;
    this._entryFormData = {
      note: '',
      plant_tag: plantTag,
      event_title: '',
      date: this._formatDateForInput(new Date())
    };
    this._render();
  },

  /** Store one diary form field in the local entry form data. */
  _updateFormField(field, value) {
    this._entryFormData[field] = value;
  },

  /** Submit the diary entry via growhelper.add_diary_entry (append-only diary, ADR-0001); empty notes are ignored. */
  _submitDiaryEntry() {
    // Submit the diary entry via service call
    if (!this._entryFormData.note.trim()) {
      return; // Don't submit empty notes
    }

    // Format the entry first (before resetting _entryFormData)
    var newEntry = this._formatDiaryEntry(this._entryFormData);

    this._errorMessage = '';
    var submitCall = this._callHassService('growhelper', 'add_diary_entry', {
      note: this._entryFormData.note,
      plant_tag: this._entryFormData.plant_tag,
      event_title: this._entryFormData.event_title || undefined,
      date: this._entryFormData.date || undefined
    });
    if (submitCall && typeof submitCall.catch === 'function') {
      submitCall.catch((error) => {
        this._errorMessage = 'Eintrag konnte nicht gespeichert werden: ' + this._errorText(error);
        this._render();
        console.error('Error adding diary entry:', error);
      });
    }

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
  },

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

      this._errorMessage = '';
      this._activeGrowRun = startResponse.run_name;
      this._diaryRunName = '';
      this._diaryContent = '';
      this._growthPhase = 'early-veg';
      this._loadTargetProfile();
      this._loadDiaryContent();
      this._render();
    }).catch((error) => {
      this._errorMessage = 'Grow Run konnte nicht gestartet werden: ' + this._errorText(error);
      this._render();
      console.error('Error starting Grow Run:', error);
    });
  },

  /** Switch the Growth Phase via the admin-only service (issue #29).
   *
   * The service applies the Target Profile through the existing ADR-0002
   * bridge (input helpers); the panel re-renders from the next hass update
   * (sensor.growhelper_config.growth_phase + helper states), so there is no
   * optimistic update. Failures surface in the error banner.
   */
  _setGrowthPhase(phase) {
    var call = this._callHassService('growhelper', 'set_growth_phase', { phase: phase }, false);
    if (!call || typeof call.then !== 'function') {
      this._errorMessage = 'Growth Phase konnte nicht gewechselt werden: keine Home-Assistant-Verbindung';
      this._render();
      return;
    }
    call
      .then(() => {
        if (this._errorMessage.startsWith('Growth Phase konnte nicht')) {
          this._errorMessage = '';
          this._render();
        }
      })
      .catch((error) => {
        this._errorMessage = 'Growth Phase konnte nicht gewechselt werden: ' + this._errorText(error);
        this._render();
      });
  }
};
