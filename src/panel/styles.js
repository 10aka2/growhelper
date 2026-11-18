/**
 * Panel CSS (PANEL_STYLES), injected by _render (issue #32 split).
 */


// Static styles for the dashboard rendered in the shadow root.
export const PANEL_STYLES = `<style>
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

        .error-banner {
          background: var(--error-color, #db4437);
          color: #ffffff;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
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
        .growth-phase .phase-select {
          background: transparent;
          color: inherit;
          border: none;
          font: inherit;
          cursor: pointer;
        }
        .growth-phase .phase-select option {
          color: #000;
        }
        .plant-quick-entry {
          width: 100%;
          margin-top: 8px;
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

        /* Toggleable devices (issue #28): clickable cards and light state. */
        .device-card[data-action],
        .light-state[data-action] {
          cursor: pointer;
        }

        .device-card[data-action]:hover {
          outline: 1px solid var(--primary-color, #03a9f4);
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
