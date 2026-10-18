"""Integration tests for Issue #7: Grow Diary backend (storage + services).

This module contains end-to-end tests that verify the complete implementation
of Issue #7 requirements:

1. `add_diary_entry` appends an entry to the active Grow Run's file in the
   exact ADR-0001 format
2. `start_grow_run` creates a new diary file, marks the run active and sets
   the phase to `early-veg`
3. The existing prototype entries are present in the first Grow Run's file
4. Tests assert file contents, active-run tracking and the phase reset

These tests simulate the actual usage of the services and verify the
complete workflow from service call to file system changes.
"""

from __future__ import annotations

import os
import tempfile
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, AsyncMock, patch

import pytest


@pytest.fixture
def temp_config_dir():
    """Create a temporary config directory for testing."""
    with tempfile.TemporaryDirectory() as temp_dir:
        yield Path(temp_dir)


@pytest.fixture
def mock_hass_with_temp_dir(temp_config_dir):
    """Create a mock Home Assistant with a real temp directory."""
    hass = MagicMock()
    hass.config.config_dir = str(temp_config_dir)
    hass.services.async_call = AsyncMock()

    # async_update_entry must actually update entry.options so that
    # async_get_active_grow_run sees the change (mirrors real HA behaviour).
    def update_entry(entry, **kwargs):
        if "options" in kwargs:
            entry.options = kwargs["options"]
    hass.config_entries.async_update_entry = MagicMock(side_effect=update_entry)
    return hass


@pytest.fixture
def mock_config_entry():
    """Create a mock config entry with realistic options."""
    entry = MagicMock()
    entry.options = {
        "growth_phase_early_veg": "input_boolean.early_veg",
        "growth_phase_late_veg": "input_boolean.late_veg",
        "growth_phase_late_bloom": "input_boolean.late_bloom",
        "growth_phase_dry": "input_boolean.dry",
        "growth_phase_off": "input_boolean.off",
        "temperature_lower_threshold": "input_number.temp_lower",
        "temperature_upper_threshold": "input_number.temp_upper",
        "humidity_lower_threshold": "input_number.humidity_lower",
        "humidity_upper_threshold": "input_number.humidity_upper",
        "vpd_lower_threshold": "input_number.vpd_lower",
        "vpd_upper_threshold": "input_number.vpd_upper",
        "light_on_time": "input_datetime.light_on",
        "light_off_time": "input_datetime.light_off",
        # Target profile for early-veg
        "early-veg_temperature_lower": 20.0,
        "early-veg_temperature_upper": 28.0,
        "early-veg_humidity_lower": 40.0,
        "early-veg_humidity_upper": 70.0,
        "early-veg_vpd_lower": 0.4,
        "early-veg_vpd_upper": 1.2,
        "early-veg_light_on_time": "08:00",
        "early-veg_light_off_time": "20:00",
    }
    return entry


class TestIssue7EndToEnd:
    """End-to-end tests for Issue #7 requirements."""

    @pytest.mark.asyncio
    async def test_complete_workflow(self, temp_config_dir, mock_hass_with_temp_dir, mock_config_entry):
        """Test the complete workflow: start run, add entries, verify format."""
        from custom_components.growhelper import grow_diary
        from custom_components.growhelper.const import (
            GROW_DIARY_DIRECTORY,
            GROW_DIARY_FILE_EXTENSION,
            DIARY_DATE_HEADER_PREFIX,
            DIARY_ENTRY_BULLET_PREFIX,
            DIARY_ENTRY_SEPARATOR,
        )
        
        hass = mock_hass_with_temp_dir
        
        # Step 1: Start a new Grow Run
        run_name, file_path = await grow_diary.async_start_grow_run(
            hass, mock_config_entry, run_name="test_run_1"
        )
        
        # Verify run was created and activated
        assert run_name == "test_run_1"
        assert file_path.exists()
        
        # Verify active run tracking
        active_run = await grow_diary.async_get_active_grow_run(hass, mock_config_entry)
        assert active_run == "test_run_1"
        
        # Verify phase was set to early-veg (via service call)
        assert hass.services.async_call.call_count >= 1
        phase_call = hass.services.async_call.call_args_list[-1]
        assert phase_call[0][0] == "growhelper"
        assert phase_call[0][1] == "set_growth_phase"
        assert phase_call[0][2]["phase"] == "early-veg"
        
        # Step 2: Add diary entries
        await grow_diary.async_append_diary_entry(
            hass, mock_config_entry, note="Aussaat — Banana Boogie Split", plant_tag="all"
        )
        
        await grow_diary.async_append_diary_entry(
            hass, mock_config_entry, note="Umtopfen", plant_tag="all"
        )
        
        # Step 3: Verify file contents
        content = await grow_diary.async_get_diary_content(hass, "test_run_1")
        
        # Verify ADR-0001 format
        assert DIARY_DATE_HEADER_PREFIX in content
        assert DIARY_ENTRY_BULLET_PREFIX in content
        assert "[all]" in content
        assert "Aussaat — Banana Boogie Split" in content
        assert "Umtopfen" in content
        assert DIARY_ENTRY_SEPARATOR in content
        
        # Verify entries are separated
        lines = content.strip().split("\n")
        assert len(lines) >= 5  # At least date header, two entries, separators

    @pytest.mark.asyncio
    async def test_prototype_migration(self, temp_config_dir, mock_hass_with_temp_dir, mock_config_entry):
        """Test migration of prototype entries to first Grow Run."""
        from custom_components.growhelper import grow_diary
        
        hass = mock_hass_with_temp_dir
        
        # Verify no Grow Runs exist initially
        existing_runs = await grow_diary.async_list_grow_runs(hass)
        assert len(existing_runs) == 0
        
        # Migrate prototype entries
        file_path = await grow_diary.async_migrate_prototype_entries(
            hass, mock_config_entry
        )
        
        # Verify migration created a Grow Run
        assert file_path is not None
        assert file_path.exists()
        
        # Verify active run is set
        active_run = await grow_diary.async_get_active_grow_run(hass, mock_config_entry)
        assert active_run == "grow_run_1"  # Default first run name
        
        # Verify prototype entries are in the file
        content = await grow_diary.async_get_diary_content(hass, "grow_run_1")
        assert "Aussaat — Banana Boogie Split" in content
        assert "Umtopfen" in content

    @pytest.mark.asyncio
    async def test_multiple_runs(self, temp_config_dir, mock_hass_with_temp_dir, mock_config_entry):
        """Test creating and managing multiple Grow Runs."""
        from custom_components.growhelper import grow_diary
        
        hass = mock_hass_with_temp_dir
        
        # Create first run
        run1_name, run1_path = await grow_diary.async_create_grow_run(
            hass, mock_config_entry, custom_name="run_1"
        )
        
        # Create second run
        run2_name, run2_path = await grow_diary.async_create_grow_run(
            hass, mock_config_entry, custom_name="run_2"
        )
        
        # List runs
        runs = await grow_diary.async_list_grow_runs(hass)
        assert "run_1" in runs
        assert "run_2" in runs
        
        # Activate first run
        await grow_diary.async_set_active_grow_run(hass, mock_config_entry, "run_1")
        active = await grow_diary.async_get_active_grow_run(hass, mock_config_entry)
        assert active == "run_1"
        
        # Add entry to active run
        await grow_diary.async_append_diary_entry(
            hass, mock_config_entry, note="Entry for run 1"
        )
        
        # Verify entry is in first run, not second
        content1 = await grow_diary.async_get_diary_content(hass, "run_1")
        content2 = await grow_diary.async_get_diary_content(hass, "run_2")
        
        assert "Entry for run 1" in content1
        assert "Entry for run 1" not in content2

    @pytest.mark.asyncio
    async def test_error_handling(self, temp_config_dir, mock_hass_with_temp_dir, mock_config_entry):
        """Test error handling for various scenarios."""
        from custom_components.growhelper import grow_diary
        from custom_components.growhelper.const import GROW_DIARY_FILE_EXTENSION
        
        hass = mock_hass_with_temp_dir
        
        # Test: Add entry without active run
        with pytest.raises(ValueError, match="No active Grow Run"):
            await grow_diary.async_append_diary_entry(
                hass, mock_config_entry, note="Test"
            )
        
        # Test: Create duplicate run
        await grow_diary.async_create_grow_run(
            hass, mock_config_entry, custom_name="duplicate_test"
        )
        
        with pytest.raises(ValueError, match="already exists"):
            await grow_diary.async_create_grow_run(
                hass, mock_config_entry, custom_name="duplicate_test"
            )
        
        # Test: Read non-existent diary
        with pytest.raises(FileNotFoundError):
            await grow_diary.async_get_diary_content(hass, "nonexistent")

    @pytest.mark.asyncio
    async def test_service_integration(self, temp_config_dir, mock_hass_with_temp_dir, mock_config_entry):
        """Test integration with service handlers."""
        from custom_components.growhelper.services import async_setup_services

        hass = mock_hass_with_temp_dir

        # Patch the service registration helper to capture registered handlers.
        # services.py calls service.async_register_admin_service(hass, domain,
        # service_name, handler, schema=...).
        with patch(
            "custom_components.growhelper.services.service.async_register_admin_service"
        ) as mock_register:
            await async_setup_services(hass, mock_config_entry)

        # Find the start_grow_run handler among the registered services.
        # Call signature: (hass, domain, service_name, handler, schema=...)
        register_calls = mock_register.call_args_list
        start_handler = None
        for call in register_calls:
            if call[0][2] == "start_grow_run":
                start_handler = call[0][3]
                break
        assert start_handler is not None

        # Call the service handler
        mock_call = MagicMock()
        mock_call.data = {"name": "service_test_run"}

        result = await start_handler(mock_call)

        assert "run_name" in result
        assert result["run_name"] == "service_test_run"

        # Verify the run was created
        from custom_components.growhelper import grow_diary
        runs = await grow_diary.async_list_grow_runs(hass)
        assert "service_test_run" in runs

    @pytest.mark.asyncio
    async def test_adr_0001_format_exact(self, temp_config_dir, mock_hass_with_temp_dir, mock_config_entry):
        """Test exact ADR-0001 format compliance."""
        from custom_components.growhelper import grow_diary
        from custom_components.growhelper.const import (
            DIARY_DATE_HEADER_PREFIX,
            DIARY_ENTRY_BULLET_PREFIX,
            DIARY_ENTRY_SEPARATOR,
        )
        
        hass = mock_hass_with_temp_dir
        
        # Create a run and add an entry with all options
        await grow_diary.async_start_grow_run(
            hass, mock_config_entry, run_name="format_test"
        )
        
        await grow_diary.async_append_diary_entry(
            hass,
            mock_config_entry,
            note="Test note",
            plant_tag="Plant 1",
            event_title="Test Event",
        )
        
        content = await grow_diary.async_get_diary_content(hass, "format_test")
        lines = content.strip().split("\n")
        
        # Verify exact format:
        # 1. Date header: ## DD.MM.YYYY
        date_line = lines[0]
        assert date_line.startswith(DIARY_DATE_HEADER_PREFIX)
        assert len(date_line) == len(DIARY_DATE_HEADER_PREFIX) + 10  # DD.MM.YYYY = 10 chars
        
        # 2. Event subheader: #### <title>
        event_line = lines[1]
        assert event_line.startswith("#### ")
        assert "Test Event" in event_line
        
        # 3. Empty line after subheader
        assert lines[2] == ""
        
        # 4. Entry bullet: - [Plant 1] Test note
        entry_line = lines[3]
        assert entry_line.startswith(DIARY_ENTRY_BULLET_PREFIX)
        assert "[Plant 1]" in entry_line
        assert "Test note" in entry_line
        
        # 5. Separator: ---
        separator_line = lines[4]
        assert separator_line == DIARY_ENTRY_SEPARATOR
