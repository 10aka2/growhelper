"""Tests for the integration's translation files (user-facing UI strings).

Repo standard (AGENTS.md): user-facing UI strings are German; the English
source (strings.json / translations/en.json) stays English. The German
Growth Phase labels must match the canonical labels the panel renders
(GROWTH_PHASE_LABELS in the panel source, introduced with #13/#14).
"""

import json
from pathlib import Path

from custom_components.growhelper.const import GROWTH_PHASES

COMPONENT_DIR = (
    Path(__file__).resolve().parent.parent / "custom_components" / "growhelper"
)

# Canonical German Growth Phase labels, shared with the panel (issues #13/#14).
CANONICAL_PHASE_LABELS = {
    "early-veg": "Frühe Vegetationsphase",
    "late-veg": "Späte Vegetationsphase",
    "late-bloom": "Späte Blüte",
    "dry": "Trocknung",
    "off": "Aus",
}

# English source labels that must stay English in strings.json / en.json.
ENGLISH_PHASE_LABELS = {
    "early-veg": "Early Veg",
    "late-veg": "Late Veg",
    "late-bloom": "Late Bloom",
    "dry": "Dry",
    "off": "Off",
}


def _options_data(path: Path) -> dict[str, str]:
    """Return the options-step data labels of a strings/translation file."""
    return json.loads(path.read_text(encoding="utf-8"))["options"]["step"]["init"]["data"]


def _phase_role_key(phase: str) -> str:
    """Map a Growth Phase key to its Entity Role key (dashes become underscores)."""
    return "growth_phase_" + phase.replace("-", "_")


def test_german_phase_labels_match_canonical_panel_labels() -> None:
    """The German options flow shows the canonical German label per phase picker."""
    data = _options_data(COMPONENT_DIR / "translations" / "de.json")
    for phase in GROWTH_PHASES:
        assert data[_phase_role_key(phase)] == f"Phase: {CANONICAL_PHASE_LABELS[phase]}"


def test_german_phase_labels_contain_no_english() -> None:
    """No English phase wording leaks into the German UI (issue #16)."""
    data = _options_data(COMPONENT_DIR / "translations" / "de.json")
    for phase in GROWTH_PHASES:
        value = data[_phase_role_key(phase)]
        for english in ENGLISH_PHASE_LABELS.values():
            assert english not in value


def test_english_sources_keep_english_labels() -> None:
    """strings.json and the English translation remain the English source."""
    for path in (
        COMPONENT_DIR / "strings.json",
        COMPONENT_DIR / "translations" / "en.json",
    ):
        data = _options_data(path)
        for phase in GROWTH_PHASES:
            assert data[_phase_role_key(phase)] == f"Growth phase: {ENGLISH_PHASE_LABELS[phase]}"


def test_translation_files_cover_the_same_options_keys() -> None:
    """de.json and en.json translate exactly the options keys of strings.json."""
    source = _options_data(COMPONENT_DIR / "strings.json")
    for name in ("de.json", "en.json"):
        translated = _options_data(COMPONENT_DIR / "translations" / name)
        assert set(translated) == set(source)
