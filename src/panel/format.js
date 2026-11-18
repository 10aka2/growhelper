/**
 * Pure formatting/escaping helpers and diary entry formatting (no hass access).
 */


export const formatMethods = {

  /** Format a date as YYYY-MM-DD for input[type="date"]; defaults to today. */
  _formatDateForInput(date) {
    // Format date for input[type="date"] (YYYY-MM-DD)
    if (!date) {
      date = new Date();
    }
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  },

  /** Format a YYYY-MM-DD date string as DD.MM.YYYY for the German diary display. */
  _formatDateForDisplay(dateStr) {
    // Format date for display (DD.MM.YYYY)
    if (!dateStr) return '';
    var date = new Date(dateStr);
    var day = String(date.getDate()).padStart(2, '0');
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var year = date.getFullYear();
    return day + '.' + month + '.' + year;
  },

  /** Format the diary form data into the markdown entry shape defined by ADR-0001. */
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
  },

  /** Escape text for HTML interpolation (textContent -> innerHTML); does not escape quotes — use _escapeAttribute inside attributes. */
  _escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  /** Escape a value for use inside a double-quoted HTML attribute.
   *
   * _escapeHtml (textContent -> innerHTML) covers & < > but not quotes, so
   * entity ids interpolated into data-entity-id="..." need this variant.
   */
  _escapeAttribute(value) {
    return this._escapeHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  /** Render diary markdown (headings, bold, lists, paragraphs) to HTML; deliberately small, no external markdown library in the bundle. */
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
  },

  /** Whether a value lies inside the Target Profile range; null when value or bounds are missing. */
  _isInRange(value, min, max) {
    if (value === null || value === undefined) return null;
    if (min === null || max === null) return null;
    return value >= min && value <= max;
  },

  /** Parse a state value to float; null for unavailable/unknown/non-numeric states. */
  _safeParseFloat(value) {
    // Safely parse float, return null for invalid values (unavailable, unknown, etc.)
    if (value === null || value === undefined || value === 'unavailable' || value === 'unknown') {
      return null;
    }
    var num = parseFloat(value);
    return isNaN(num) ? null : num;
  },

  /** Format a numeric state with fixed decimals for display; '--' when unavailable. */
  _formatNumber(value, decimals) {
    if (value === null || value === undefined) return '--';
    var num = this._safeParseFloat(value);
    return num === null ? '--' : num.toFixed(decimals || 1);
  }
};
