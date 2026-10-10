/**
 * Growhelper sidebar panel — section skeleton.
 *
 * Thin client for the Grow Box management panel: it renders the section
 * skeleton of the user's existing "section test" dashboard and holds no
 * business logic. Later tickets fill the sections with live data.
 */
import { LitElement, html, css } from "lit";

/**
 * Panel sections, mirroring the user's existing dashboard layout:
 * phases/camera/environment/diary, light + plants, climate, VPD.
 */
const SECTIONS = [
  {
    id: "overview",
    title: "Übersicht",
    cards: [
      { id: "phases", title: "Phasen" },
      { id: "camera", title: "Kamera" },
      { id: "environment", title: "Umgebung" },
      { id: "diary", title: "Tagebuch" },
    ],
  },
  { id: "light-plants", title: "Licht & Pflanzen", cards: [] },
  { id: "climate", title: "Klima", cards: [] },
  { id: "vpd", title: "VPD (Dampfdruckdefizit)", cards: [] },
];

class GrowhelperPanel extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 16px;
      max-width: 1200px;
      margin: 0 auto;
    }
    h1 {
      font-size: 24px;
      margin: 0 0 16px;
    }
    section {
      margin-bottom: 24px;
    }
    h2 {
      font-size: 18px;
      margin: 0 0 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--divider-color, #e0e0e0);
    }
    .card {
      margin-bottom: 12px;
    }
    h3 {
      font-size: 15px;
      margin: 0 0 4px;
    }
    .empty {
      color: var(--secondary-text-color, #727272);
      font-style: italic;
    }
  `;

  render() {
    return html`
      <h1>Growhelper</h1>
      ${SECTIONS.map(
        (section) => html`
          <section data-section=${section.id}>
            <h2>${section.title}</h2>
            ${section.cards.length
              ? section.cards.map(
                  (card) => html`
                    <div class="card" data-card=${card.id}>
                      <h3>${card.title}</h3>
                      <p class="empty">Noch nicht eingerichtet.</p>
                    </div>
                  `,
                )
              : html`<p class="empty">Noch nicht eingerichtet.</p>`}
          </section>
        `,
      )}
    `;
  }
}

customElements.define("growhelper-panel", GrowhelperPanel);
