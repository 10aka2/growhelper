"""Grow Diary backend for the Growhelper integration.

This module implements the Grow Diary storage and services as specified in
ADR-0001: Grow Diary is stored as markdown files on the Home Assistant filesystem.

Each Grow Run has exactly one markdown file under the Home Assistant config
directory (e.g., `<config_dir>/growhelper/<run_name>.md`). The diary format
follows ADR-0001:
- Date headers: `## DD.MM.YYYY`
- Optional event subheaders: `#### <event title>`
- Note bullets with plant tags: `- [Plant 1] <note text>` or `- [all] <note text>`
- Entries separated by `---`

The module provides:
- Grow Run management (create, list, activate)
- Diary entry appending in the ADR-0001 format
- Migration of existing prototype entries
- Active run tracking via config entry options
"""

from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import (
    CONF_ACTIVE_GROW_RUN,
    DEFAULT_FIRST_GROW_RUN_NAME,
    DIARY_DATE_HEADER_PREFIX,
    DIARY_ENTRY_ALL_TAG,
    DIARY_ENTRY_BULLET_PREFIX,
    DIARY_ENTRY_SEPARATOR,
    DIARY_EVENT_SUBHEADER_PREFIX,
    DOMAIN,
    GROW_DIARY_DIRECTORY,
    GROW_DIARY_FILE_EXTENSION,
    GROWTH_PHASES,
)


def _get_diary_directory(hass: HomeAssistant) -> Path:
    """Get the Grow Diary directory path.
    
    Returns the absolute path to the growhelper directory under the Home Assistant
    config directory where all Grow Diary files are stored.
    """
    config_dir = Path(hass.config.config_dir)
    diary_dir = config_dir / GROW_DIARY_DIRECTORY
    return diary_dir


def _get_diary_file_path(hass: HomeAssistant, run_name: str) -> Path:
    """Get the full path to a Grow Diary file.
    
    Args:
        hass: Home Assistant instance
        run_name: The name of the Grow Run (without extension)
        
    Returns:
        The absolute path to the diary file
    """
    diary_dir = _get_diary_directory(hass)
    return diary_dir / f"{run_name}{GROW_DIARY_FILE_EXTENSION}"


def _ensure_diary_directory(hass: HomeAssistant) -> Path:
    """Ensure the Grow Diary directory exists.
    
    Creates the directory if it doesn't exist.
    
    Args:
        hass: Home Assistant instance
        
    Returns:
        The path to the diary directory
    """
    diary_dir = _get_diary_directory(hass)
    # Only create if it doesn't exist
    if not diary_dir.exists():
        diary_dir.mkdir(parents=True, exist_ok=True)
    return diary_dir


def _format_date_header(date: datetime | None = None) -> str:
    """Format a date as a diary date header.
    
    Args:
        date: The date to format. If None, uses current date.
        
    Returns:
        Formatted date header string (e.g., "## 10.10.2024")
    """
    if date is None:
        date = datetime.now()
    return f"{DIARY_DATE_HEADER_PREFIX}{date.strftime('%d.%m.%Y')}"


def _format_entry_bullet(plant_tag: str, note: str) -> str:
    """Format a diary entry bullet with plant tag.
    
    Args:
        plant_tag: The plant tag (e.g., "Plant 1", "all")
        note: The note text
        
    Returns:
        Formatted entry bullet string (e.g., "- [Plant 1] Note text")
    """
    return f"{DIARY_ENTRY_BULLET_PREFIX}{plant_tag}] {note}"


def _generate_run_name() -> str:
    """Generate a date-based Grow Run name.
    
    Returns a suggested name in the format 'grow_run_YYYYMMDD'.
    This can be overridden by the user when starting a new run.
    """
    today = datetime.now()
    return f"grow_run_{today.strftime('%Y%m%d')}"


async def async_get_active_grow_run(hass: HomeAssistant, entry: ConfigEntry) -> str | None:
    """Get the name of the currently active Grow Run.
    
    Args:
        hass: Home Assistant instance
        entry: Config entry for the Grow Box
        
    Returns:
        The name of the active Grow Run, or None if no run is active
    """
    return entry.options.get(CONF_ACTIVE_GROW_RUN)


async def async_set_active_grow_run(
    hass: HomeAssistant, entry: ConfigEntry, run_name: str
) -> None:
    """Set the active Grow Run for a config entry.
    
    Args:
        hass: Home Assistant instance
        entry: Config entry for the Grow Box
        run_name: The name of the Grow Run to activate
    """
    # Create a new options dict with the active run updated
    new_options = dict(entry.options)
    new_options[CONF_ACTIVE_GROW_RUN] = run_name
    
    # Update the config entry options
    hass.config_entries.async_update_entry(
        entry,
        options=new_options,
    )


async def async_list_grow_runs(hass: HomeAssistant) -> list[str]:
    """List all existing Grow Run names.
    
    Args:
        hass: Home Assistant instance
        
    Returns:
        List of Grow Run names (without extension) that exist as diary files
    """
    diary_dir = _get_diary_directory(hass)
    
    if not diary_dir.exists():
        return []
    
    grow_runs = []
    for file_path in diary_dir.glob(f"*{GROW_DIARY_FILE_EXTENSION}"):
        # Remove the extension to get the run name
        run_name = file_path.stem
        grow_runs.append(run_name)
    
    return sorted(grow_runs)


async def async_create_grow_run(
    hass: HomeAssistant,
    entry: ConfigEntry,
    run_name: str | None = None,
    custom_name: str | None = None,
) -> tuple[str, Path]:
    """Create a new Grow Run with an empty diary file.
    
    Args:
        hass: Home Assistant instance
        entry: Config entry for the Grow Box
        run_name: Suggested name (date-based if None)
        custom_name: User-provided custom name (overrides run_name)
        
    Returns:
        Tuple of (run_name, file_path) for the created Grow Run
        
    Raises:
        ValueError: If a Grow Run with the same name already exists
    """
    # Determine the final run name
    if custom_name:
        final_name = custom_name
    elif run_name:
        final_name = run_name
    else:
        final_name = _generate_run_name()
    
    # Check if a diary file with this name already exists
    _ensure_diary_directory(hass)
    file_path = _get_diary_file_path(hass, final_name)
    
    if file_path.exists():
        raise ValueError(
            f"A Grow Run with name '{final_name}' already exists. "
            f"Choose a different name."
        )
    
    # Create the empty diary file.
    # No initial content: the first appended entry brings its own date header
    # (ADR-0001), so an initial header would produce a duplicate.
    file_path.touch()

    return final_name, file_path


async def async_start_grow_run(
    hass: HomeAssistant,
    entry: ConfigEntry,
    run_name: str | None = None,
) -> tuple[str, Path]:
    """Start a new Grow Run: create diary file, mark as active, set phase to early-veg.
    
    This is the main service handler for starting a new cultivation cycle.
    It creates the diary file, activates the run, and sets the initial Growth Phase.
    
    Args:
        hass: Home Assistant instance
        entry: Config entry for the Grow Box
        run_name: Optional custom name for the Grow Run
        
    Returns:
        Tuple of (run_name, file_path) for the started Grow Run
        
    Raises:
        ValueError: If a Grow Run with the same name already exists
    """
    # Create the new Grow Run
    final_name, file_path = await async_create_grow_run(
        hass, entry, run_name=run_name
    )
    
    # Mark this run as active
    await async_set_active_grow_run(hass, entry, final_name)
    
    # Set the initial Growth Phase to early-veg
    # This is done by calling the set_growth_phase service
    await hass.services.async_call(
        DOMAIN,
        "set_growth_phase",
        {"phase": "early-veg"},
    )
    
    return final_name, file_path


async def async_append_diary_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    note: str,
    plant_tag: str = DIARY_ENTRY_ALL_TAG,
    event_title: str | None = None,
    date: datetime | None = None,
) -> Path:
    """Append a diary entry to the active Grow Run's file.
    
    The entry is formatted according to ADR-0001:
    - Date header (if different from last entry's date)
    - Optional event subheader
    - Note bullet with plant tag
    - Separator
    
    Args:
        hass: Home Assistant instance
        entry: Config entry for the Grow Box
        note: The note text to add
        plant_tag: The plant tag for the entry (default: "all")
        event_title: Optional event title for a subheader
        date: Optional date for the entry (default: current date)
        
    Returns:
        The path to the diary file that was updated
        
    Raises:
        ValueError: If no Grow Run is currently active
        FileNotFoundError: If the active Grow Run's diary file doesn't exist
    """
    # Get the active Grow Run
    active_run = await async_get_active_grow_run(hass, entry)
    
    if not active_run:
        raise ValueError(
            "No active Grow Run. Start a Grow Run first with start_grow_run service."
        )
    
    # Get the diary file path
    file_path = _get_diary_file_path(hass, active_run)
    
    if not file_path.exists():
        raise FileNotFoundError(
            f"Diary file for Grow Run '{active_run}' not found at {file_path}"
        )
    
    # Keep filesystem access off Home Assistant's event loop.
    existing_content = await hass.async_add_executor_job(file_path.read_text, "utf-8")
    
    # Build the new entry
    entry_lines = []
    
    # Add date header
    entry_date = date if date else datetime.now()
    entry_lines.append(_format_date_header(entry_date))
    
    # Add event subheader if provided
    if event_title:
        entry_lines.append(f"{DIARY_EVENT_SUBHEADER_PREFIX}{event_title}")
        entry_lines.append("")  # Empty line after subheader
    
    # Add note bullet
    entry_lines.append(_format_entry_bullet(plant_tag, note))
    
    # Add separator
    entry_lines.append(DIARY_ENTRY_SEPARATOR)
    
    # Combine with existing content
    if existing_content and not existing_content.endswith("\n"):
        existing_content += "\n"
    
    new_content = existing_content + "\n".join(entry_lines) + "\n"
    
    await hass.async_add_executor_job(file_path.write_text, new_content, "utf-8")
    
    return file_path


async def async_migrate_prototype_entries(
    hass: HomeAssistant,
    entry: ConfigEntry,
) -> Path | None:
    """Migrate existing prototype diary entries to the first Grow Run.
    
    This function handles the one-time migration of the grower's existing
    prototype entries (Aussaat — Banana Boogie Split; Umtopfen) into the
    first Grow Run's diary file.
    
    The prototype entries are:
    - Aussaat (sowing) for Banana Boogie Split cultivar
    - Umtopfen (transplanting)
    
    Args:
        hass: Home Assistant instance
        entry: Config entry for the Grow Box
        
    Returns:
        The path to the updated diary file, or None if no migration was needed
    """
    # Check if we already have Grow Runs
    existing_runs = await async_list_grow_runs(hass)
    
    # Only migrate if this is the first Grow Run
    if len(existing_runs) > 0:
        return None
    
    # Create the first Grow Run
    run_name, file_path = await async_create_grow_run(
        hass, entry, custom_name=DEFAULT_FIRST_GROW_RUN_NAME
    )

    # Mark it as active via the proper HA API (updates entry.options internally)
    await async_set_active_grow_run(hass, entry, run_name)
    
    # Define the prototype entries to migrate
    # These are based on the grower's existing entries.
    # Each entry is a (note, plant_tag, event_title) tuple.
    prototype_entries: list[tuple[str, str, str | None]] = [
        ("Aussaat — Banana Boogie Split", "all", None),
        ("Umtopfen", "all", None),
    ]

    # Append each prototype entry
    for note, plant_tag, event_title in prototype_entries:
        await async_append_diary_entry(
            hass,
            entry,
            note=note,
            plant_tag=plant_tag,
            event_title=event_title,
        )
    
    return file_path


async def async_get_diary_content(
    hass: HomeAssistant,
    run_name: str,
) -> str:
    """Get the full content of a Grow Diary file.
    
    Args:
        hass: Home Assistant instance
        run_name: The name of the Grow Run
        
    Returns:
        The content of the diary file as a string
        
    Raises:
        FileNotFoundError: If the diary file doesn't exist
    """
    file_path = _get_diary_file_path(hass, run_name)
    
    if not file_path.exists():
        raise FileNotFoundError(
            f"Diary file for Grow Run '{run_name}' not found at {file_path}"
        )
    
    return await hass.async_add_executor_job(file_path.read_text, "utf-8")
