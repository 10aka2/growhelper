"""Simple unit tests for the Grow Diary backend module.

These tests verify the core functionality without Home Assistant fixtures,
using simple mocking and direct function calls.
"""

from __future__ import annotations

import os
import tempfile
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch, AsyncMock

import pytest

# Import the module under test
from custom_components.growhelper.grow_diary import (
    _get_diary_directory,
    _get_diary_file_path,
    _ensure_diary_directory,
    _format_date_header,
    _format_entry_bullet,
    _generate_run_name,
    async_get_active_grow_run,
    async_set_active_grow_run,
    async_list_grow_runs,
    async_create_grow_run,
    async_start_grow_run,
    async_append_diary_entry,
    async_migrate_prototype_entries,
    async_get_diary_content,
)
from custom_components.growhelper.const import (
    GROW_DIARY_DIRECTORY,
    GROW_DIARY_FILE_EXTENSION,
    DIARY_DATE_HEADER_PREFIX,
    DIARY_ENTRY_BULLET_PREFIX,
    DIARY_ENTRY_SEPARATOR,
    DIARY_EVENT_SUBHEADER_PREFIX,
    DEFAULT_FIRST_GROW_RUN_NAME,
)


@pytest.fixture
def temp_config_dir():
    """Create a temporary config directory for testing."""
    with tempfile.TemporaryDirectory() as temp_dir:
        yield Path(temp_dir)


@pytest.fixture
def mock_hass(temp_config_dir):
    """Create a mock Home Assistant instance with real temp directory."""
    hass = MagicMock()
    hass.config.config_dir = str(temp_config_dir)
    return hass


@pytest.fixture
def mock_config_entry():
    """Create a mock config entry."""
    entry = MagicMock()
    entry.options = {}
    return entry


class TestDiaryPathFunctions:
    """Tests for diary path and directory functions."""

    def test_get_diary_directory(self, mock_hass):
        """Test getting the diary directory path."""
        result = _get_diary_directory(mock_hass)
        expected = Path(mock_hass.config.config_dir) / GROW_DIARY_DIRECTORY
        assert result == expected

    def test_get_diary_file_path(self, mock_hass):
        """Test getting a diary file path."""
        result = _get_diary_file_path(mock_hass, "my_run")
        expected = Path(mock_hass.config.config_dir) / GROW_DIARY_DIRECTORY / f"my_run{GROW_DIARY_FILE_EXTENSION}"
        assert result == expected

    def test_ensure_diary_directory_creates_dir(self, mock_hass):
        """Test that ensure_diary_directory creates the directory if it doesn't exist."""
        result = _ensure_diary_directory(mock_hass)
        
        # Verify directory was created
        expected_dir = Path(mock_hass.config.config_dir) / GROW_DIARY_DIRECTORY
        assert expected_dir.exists()
        assert result == expected_dir

    def test_ensure_diary_directory_existing(self, mock_hass):
        """Test that ensure_diary_directory doesn't fail on existing directory."""
        # Create directory first
        expected_dir = Path(mock_hass.config.config_dir) / GROW_DIARY_DIRECTORY
        expected_dir.mkdir(parents=True, exist_ok=True)
        
        result = _ensure_diary_directory(mock_hass)
        
        assert expected_dir.exists()
        assert result == expected_dir


class TestFormatFunctions:
    """Tests for formatting functions."""

    @patch("custom_components.growhelper.grow_diary.datetime")
    def test_format_date_header_default(self, mock_datetime):
        """Test formatting a date header with current date."""
        mock_datetime.now.return_value = datetime(2024, 10, 15)
        result = _format_date_header()
        assert result == "## 15.10.2024"

    def test_format_date_header_specific(self):
        """Test formatting a date header with a specific date."""
        test_date = datetime(2024, 1, 1)
        result = _format_date_header(test_date)
        assert result == "## 01.01.2024"

    def test_format_entry_bullet(self):
        """Test formatting an entry bullet."""
        result = _format_entry_bullet("Plant 1", "Test note")
        assert result == "- [Plant 1] Test note"

    def test_format_entry_bullet_all_tag(self):
        """Test formatting an entry bullet with 'all' tag."""
        result = _format_entry_bullet("all", "Box level note")
        assert result == "- [all] Box level note"

    @patch("custom_components.growhelper.grow_diary.datetime")
    def test_generate_run_name(self, mock_datetime):
        """Test generating a date-based run name."""
        mock_datetime.now.return_value = datetime(2024, 10, 15)
        result = _generate_run_name()
        assert result == "grow_run_20241015"


class TestActiveRunTracking:
    """Tests for active Grow Run tracking."""

    @pytest.mark.asyncio
    async def test_get_active_grow_run_none(self, mock_hass, mock_config_entry):
        """Test getting active run when none is set."""
        result = await async_get_active_grow_run(mock_hass, mock_config_entry)
        assert result is None

    @pytest.mark.asyncio
    async def test_get_active_grow_run_set(self, mock_hass):
        """Test getting active run when one is set."""
        entry = MagicMock()
        entry.options = {"active_grow_run": "test_run_1"}
        
        result = await async_get_active_grow_run(mock_hass, entry)
        assert result == "test_run_1"

    @pytest.mark.asyncio
    async def test_set_active_grow_run(self, mock_hass, mock_config_entry):
        """Test setting the active Grow Run."""
        # Mock the config_entries async_update_entry method
        mock_hass.config_entries.async_update_entry = MagicMock()
        
        await async_set_active_grow_run(mock_hass, mock_config_entry, "new_run")
        
        # Verify the options were updated
        mock_hass.config_entries.async_update_entry.assert_called_once()
        call_args = mock_hass.config_entries.async_update_entry.call_args
        assert call_args[0][0] == mock_config_entry
        assert call_args[1]["options"]["active_grow_run"] == "new_run"


class TestGrowRunManagement:
    """Tests for Grow Run creation and listing."""

    @pytest.mark.asyncio
    async def test_list_grow_runs_empty(self, mock_hass):
        """Test listing Grow Runs when directory doesn't exist."""
        result = await async_list_grow_runs(mock_hass)
        assert result == []

    @pytest.mark.asyncio
    async def test_list_grow_runs_with_files(self, mock_hass, temp_config_dir):
        """Test listing Grow Runs with existing files."""
        # Create some diary files
        diary_dir = temp_config_dir / GROW_DIARY_DIRECTORY
        diary_dir.mkdir(parents=True, exist_ok=True)
        
        (diary_dir / "run_1.md").touch()
        (diary_dir / "run_2.md").touch()
        
        result = await async_list_grow_runs(mock_hass)
        assert "run_1" in result
        assert "run_2" in result

    @pytest.mark.asyncio
    async def test_create_grow_run(self, mock_hass, mock_config_entry):
        """Test creating a new Grow Run."""
        run_name, file_path = await async_create_grow_run(
            mock_hass, mock_config_entry, custom_name="test_run"
        )
        
        assert run_name == "test_run"
        assert file_path.exists()
        assert file_path.name == "test_run.md"
        
        # Verify initial content
        content = file_path.read_text()
        assert DIARY_DATE_HEADER_PREFIX in content

    @pytest.mark.asyncio
    async def test_create_grow_run_duplicate(self, mock_hass, mock_config_entry):
        """Test that creating a duplicate Grow Run raises an error."""
        # Create first run
        await async_create_grow_run(
            mock_hass, mock_config_entry, custom_name="duplicate_test"
        )
        
        # Try to create duplicate
        with pytest.raises(ValueError, match="already exists"):
            await async_create_grow_run(
                mock_hass, mock_config_entry, custom_name="duplicate_test"
            )


class TestDiaryEntryAppending:
    """Tests for appending diary entries."""

    @pytest.mark.asyncio
    async def test_append_diary_entry_no_active_run(self, mock_hass, mock_config_entry):
        """Test that appending without an active run raises an error."""
        with pytest.raises(ValueError, match="No active Grow Run"):
            await async_append_diary_entry(
                mock_hass, mock_config_entry, note="Test note"
            )

    @pytest.mark.asyncio
    async def test_append_diary_entry_file_not_found(self, mock_hass, mock_config_entry):
        """Test that appending to a non-existent file raises an error."""
        # Set active run to non-existent file
        mock_config_entry.options = {"active_grow_run": "nonexistent"}
        
        with pytest.raises(FileNotFoundError, match="not found"):
            await async_append_diary_entry(
                mock_hass, mock_config_entry, note="Test note"
            )

    @pytest.mark.asyncio
    async def test_append_diary_entry_success(self, mock_hass, mock_config_entry):
        """Test successful diary entry appending."""
        # Create a run first
        run_name, file_path = await async_create_grow_run(
            mock_hass, mock_config_entry, custom_name="append_test"
        )
        
        # Set it as active - need to update the mock entry options
        mock_config_entry.options = {"active_grow_run": run_name}
        
        # Append an entry
        result = await async_append_diary_entry(
            mock_hass,
            mock_config_entry,
            note="Test note",
            plant_tag="Plant 1",
            event_title="Test Event",
        )
        
        assert result == file_path
        
        # Verify content
        content = file_path.read_text()
        assert "Test note" in content
        assert "[Plant 1]" in content
        assert "Test Event" in content
        assert DIARY_ENTRY_SEPARATOR in content


class TestStartGrowRun:
    """Tests for starting a Grow Run."""

    @pytest.mark.asyncio
    async def test_start_grow_run(self, mock_hass, mock_config_entry):
        """Test starting a new Grow Run."""
        mock_hass.services.async_call = AsyncMock()
        mock_hass.config_entries.async_update_entry = MagicMock()
        
        run_name, file_path = await async_start_grow_run(
            mock_hass, mock_config_entry, run_name="new_run"
        )
        
        assert run_name == "new_run"
        assert file_path.exists()
        
        # Verify active run was set - check the update call
        assert mock_hass.config_entries.async_update_entry.call_count >= 1
        update_call = mock_hass.config_entries.async_update_entry.call_args
        assert update_call[1]["options"]["active_grow_run"] == "new_run"
        
        # Verify phase was set to early-veg
        assert mock_hass.services.async_call.call_count >= 1
        phase_call = mock_hass.services.async_call.call_args_list[-1]
        assert phase_call[0][0] == "growhelper"
        assert phase_call[0][1] == "set_growth_phase"
        assert phase_call[0][2]["phase"] == "early-veg"


class TestPrototypeMigration:
    """Tests for migrating prototype entries."""

    @pytest.mark.asyncio
    async def test_migrate_prototype_entries_no_runs(self, mock_hass, mock_config_entry):
        """Test migration when no Grow Runs exist."""
        mock_hass.config_entries.async_update_entry = MagicMock()
        
        file_path = await async_migrate_prototype_entries(
            mock_hass, mock_config_entry
        )
        
        # Should create first run and append prototype entries
        assert file_path is not None
        assert file_path.exists()
        
        # Verify active run is set - check the update call
        assert mock_hass.config_entries.async_update_entry.call_count >= 1
        update_call = mock_hass.config_entries.async_update_entry.call_args
        assert update_call[1]["options"]["active_grow_run"] == DEFAULT_FIRST_GROW_RUN_NAME
        
        # Verify prototype entries are in the file
        content = file_path.read_text()
        assert "Aussaat — Banana Boogie Split" in content
        assert "Umtopfen" in content

    @pytest.mark.asyncio
    async def test_migrate_prototype_entries_existing_runs(self, mock_hass, mock_config_entry):
        """Test that migration is skipped when Grow Runs already exist."""
        # Create a run first
        await async_create_grow_run(
            mock_hass, mock_config_entry, custom_name="existing_run"
        )
        
        result = await async_migrate_prototype_entries(mock_hass, mock_config_entry)
        
        assert result is None


class TestDiaryContentReading:
    """Tests for reading diary content."""

    @pytest.mark.asyncio
    async def test_get_diary_content_success(self, mock_hass, mock_config_entry):
        """Test reading diary content successfully."""
        # Create a run with content
        run_name, file_path = await async_create_grow_run(
            mock_hass, mock_config_entry, custom_name="read_test"
        )
        
        # Write some content
        file_path.write_text("# Test content")
        
        result = await async_get_diary_content(mock_hass, "read_test")
        assert result == "# Test content"

    @pytest.mark.asyncio
    async def test_get_diary_content_not_found(self, mock_hass):
        """Test reading diary content when file doesn't exist."""
        with pytest.raises(FileNotFoundError):
            await async_get_diary_content(mock_hass, "nonexistent")


class TestADR0001FormatCompliance:
    """Tests to ensure ADR-0001 format compliance."""

    @pytest.mark.asyncio
    async def test_entry_format_compliance(self, mock_hass, mock_config_entry):
        """Test that appended entries follow ADR-0001 format."""
        # Create a run
        run_name, file_path = await async_create_grow_run(
            mock_hass, mock_config_entry, custom_name="format_test"
        )
        
        # Set as active
        mock_config_entry.options = {"active_grow_run": run_name}
        
        # Add entry with all options
        await async_append_diary_entry(
            hass=mock_hass,
            entry=mock_config_entry,
            note="Test note",
            plant_tag="Plant 1",
            event_title="Test Event",
        )
        
        content = file_path.read_text()
        
        # Verify ADR-0001 format elements are present
        assert DIARY_DATE_HEADER_PREFIX in content
        assert "#### Test Event" in content
        assert DIARY_ENTRY_BULLET_PREFIX in content
        assert "[Plant 1]" in content
        assert "Test note" in content
        assert DIARY_ENTRY_SEPARATOR in content

    @pytest.mark.asyncio
    async def test_multiple_entries_format(self, mock_hass, mock_config_entry):
        """Test that multiple entries maintain proper format."""
        # Create a run
        run_name, file_path = await async_create_grow_run(
            mock_hass, mock_config_entry, custom_name="multi_test"
        )
        
        # Set as active
        mock_config_entry.options = {"active_grow_run": run_name}
        
        # Add multiple entries
        await async_append_diary_entry(
            mock_hass, mock_config_entry, note="Entry 1", plant_tag="all"
        )
        await async_append_diary_entry(
            mock_hass, mock_config_entry, note="Entry 2", plant_tag="Plant 1"
        )
        
        content = file_path.read_text()
        
        # Verify both entries are present
        assert "Entry 1" in content
        assert "Entry 2" in content
        assert "[all]" in content
        assert "[Plant 1]" in content
        
        # Verify separators
        assert content.count(DIARY_ENTRY_SEPARATOR) == 2
