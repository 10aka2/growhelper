"""Tests for the Grow Diary backend module.

This module tests the Grow Diary storage and management functions as specified
in Issue #7 and ADR-0001. Tests cover:

- Grow Run creation and management
- Diary entry appending in ADR-0001 format
- Active run tracking
- Prototype entry migration
- File content validation

All tests use mocking to avoid actual filesystem operations and Home Assistant
dependencies, making them fast and isolated.
"""

from __future__ import annotations

import os
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
def mock_hass():
    """Create a mock Home Assistant instance."""
    hass = MagicMock()
    hass.config.config_dir = "/tmp/test_config"
    hass.services.async_call = AsyncMock()
    hass.async_add_executor_job = AsyncMock(side_effect=lambda function, *args: function(*args))
    return hass


@pytest.fixture
def mock_config_entry():
    """Create a mock config entry."""
    entry = MagicMock()
    entry.options = {}
    return entry


@pytest.fixture
def mock_config_entry_with_active_run():
    """Create a mock config entry with an active Grow Run."""
    entry = MagicMock()
    entry.options = {"active_grow_run": "test_run_1"}
    return entry


class TestDiaryPathFunctions:
    """Tests for diary path and directory functions."""

    def test_get_diary_directory(self, mock_hass):
        """Test getting the diary directory path."""
        result = _get_diary_directory(mock_hass)
        expected = Path("/tmp/test_config") / GROW_DIARY_DIRECTORY
        assert result == expected

    def test_get_diary_file_path(self, mock_hass):
        """Test getting a diary file path."""
        result = _get_diary_file_path(mock_hass, "my_run")
        expected = Path("/tmp/test_config") / GROW_DIARY_DIRECTORY / f"my_run{GROW_DIARY_FILE_EXTENSION}"
        assert result == expected

    def test_ensure_diary_directory_creates_dir(self, mock_hass):
        """Test that ensure_diary_directory creates the directory if it doesn't exist."""
        with patch("custom_components.growhelper.grow_diary._get_diary_directory") as mock_get_dir:
            mock_dir = MagicMock(spec=Path)
            mock_dir.exists.return_value = False
            mock_get_dir.return_value = mock_dir

            result = _ensure_diary_directory(mock_hass)

            mock_dir.mkdir.assert_called_once_with(parents=True, exist_ok=True)
            assert result == mock_dir

    def test_ensure_diary_directory_existing(self, mock_hass):
        """Test that ensure_diary_directory doesn't recreate existing directory."""
        with patch("custom_components.growhelper.grow_diary._get_diary_directory") as mock_get_dir:
            mock_dir = MagicMock(spec=Path)
            mock_dir.exists.return_value = True
            mock_get_dir.return_value = mock_dir

            result = _ensure_diary_directory(mock_hass)

            mock_dir.mkdir.assert_not_called()
            assert result == mock_dir


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
    async def test_get_active_grow_run_set(self, mock_hass, mock_config_entry_with_active_run):
        """Test getting active run when one is set."""
        result = await async_get_active_grow_run(mock_hass, mock_config_entry_with_active_run)
        assert result == "test_run_1"

    @pytest.mark.asyncio
    @patch("custom_components.growhelper.grow_diary.HomeAssistant")
    async def test_set_active_grow_run(self, mock_hass_class, mock_hass, mock_config_entry):
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
    @patch("custom_components.growhelper.grow_diary._ensure_diary_directory")
    @patch("custom_components.growhelper.grow_diary.Path")
    async def test_list_grow_runs_empty(self, mock_path, mock_ensure_dir, mock_hass):
        """Test listing Grow Runs when directory doesn't exist."""
        mock_dir = MagicMock(spec=Path)
        mock_dir.exists.return_value = False
        mock_path.return_value = mock_dir
        mock_ensure_dir.return_value = mock_dir
        
        result = await async_list_grow_runs(mock_hass)
        assert result == []

    @pytest.mark.asyncio
    @patch("custom_components.growhelper.grow_diary._get_diary_directory")
    async def test_list_grow_runs_with_files(self, mock_get_dir, mock_hass):
        """Test listing Grow Runs with existing files."""
        mock_dir = MagicMock(spec=Path)
        mock_dir.exists.return_value = True
        
        # Create mock files
        mock_file1 = MagicMock(spec=Path)
        mock_file1.stem = "run_1"
        mock_file2 = MagicMock(spec=Path)
        mock_file2.stem = "run_2"
        
        mock_dir.glob.return_value = [mock_file1, mock_file2]
        mock_get_dir.return_value = mock_dir
        
        result = await async_list_grow_runs(mock_hass)
        assert result == ["run_1", "run_2"]

    @pytest.mark.asyncio
    async def test_create_grow_run(self, mock_hass, mock_config_entry):
        """Test creating a new Grow Run."""
        with patch("custom_components.growhelper.grow_diary._ensure_diary_directory") as mock_ensure_dir:
            with patch("custom_components.growhelper.grow_diary._get_diary_file_path") as mock_get_path:
                mock_dir = MagicMock(spec=Path)
                mock_file_path = MagicMock(spec=Path)
                mock_file_path.exists.return_value = False

                mock_ensure_dir.return_value = mock_dir
                mock_get_path.return_value = mock_file_path

                run_name, file_path = await async_create_grow_run(
                    mock_hass, mock_config_entry, custom_name="test_run"
                )

                assert run_name == "test_run"
                assert file_path == mock_file_path
                # The file is created empty; first entry brings the date header
                mock_file_path.touch.assert_called_once()

    @pytest.mark.asyncio
    @patch("custom_components.growhelper.grow_diary._ensure_diary_directory")
    @patch("custom_components.growhelper.grow_diary._get_diary_file_path")
    async def test_create_grow_run_duplicate(self, mock_get_path, mock_ensure_dir, mock_hass, mock_config_entry):
        """Test that creating a duplicate Grow Run raises an error."""
        mock_file_path = MagicMock(spec=Path)
        mock_file_path.exists.return_value = True
        
        mock_get_path.return_value = mock_file_path
        
        with pytest.raises(ValueError, match="already exists"):
            await async_create_grow_run(
                mock_hass, mock_config_entry, custom_name="duplicate_run"
            )


class TestDiaryEntryAppending:
    """Tests for appending diary entries."""

    @pytest.mark.asyncio
    async def test_append_diary_entry_no_active_run(
        self, mock_hass, mock_config_entry
    ):
        """Test that appending without an active run raises an error."""
        with patch("custom_components.growhelper.grow_diary.async_get_active_grow_run") as mock_get_active:
            mock_get_active.return_value = None
            
            with pytest.raises(ValueError, match="No active Grow Run"):
                await async_append_diary_entry(
                    mock_hass, mock_config_entry, note="Test note"
                )

    @pytest.mark.asyncio
    async def test_append_diary_entry_file_not_found(
        self, mock_hass, mock_config_entry
    ):
        """Test that appending to a non-existent file raises an error."""
        with patch("custom_components.growhelper.grow_diary.async_get_active_grow_run") as mock_get_active:
            with patch("custom_components.growhelper.grow_diary._get_diary_file_path") as mock_get_path:
                mock_get_active.return_value = "test_run"
                mock_file_path = MagicMock(spec=Path)
                mock_file_path.exists.return_value = False
                mock_get_path.return_value = mock_file_path
                
                with pytest.raises(FileNotFoundError, match="not found"):
                    await async_append_diary_entry(
                        mock_hass, mock_config_entry, note="Test note"
                    )

    @pytest.mark.asyncio
    async def test_append_diary_entry_success(
        self, mock_hass, mock_config_entry
    ):
        """Test successful diary entry appending."""
        with patch("custom_components.growhelper.grow_diary.async_get_active_grow_run") as mock_get_active:
            with patch("custom_components.growhelper.grow_diary._get_diary_file_path") as mock_get_path:
                mock_get_active.return_value = "test_run"
                mock_file_path = MagicMock(spec=Path)
                mock_file_path.exists.return_value = True
                mock_get_path.return_value = mock_file_path
                
                mock_file_path.read_text.return_value = ""
                result = await async_append_diary_entry(
                    mock_hass,
                    mock_config_entry,
                    note="Test note",
                    plant_tag="Plant 1",
                    event_title="Test Event",
                )
                
                assert result == mock_file_path
                mock_file_path.write_text.assert_called_once()


class TestStartGrowRun:
    """Tests for starting a Grow Run."""

    @pytest.mark.asyncio
    async def test_start_grow_run(
        self, mock_hass, mock_config_entry
    ):
        """Test starting a new Grow Run."""
        with patch("custom_components.growhelper.grow_diary.async_create_grow_run") as mock_create:
            with patch("custom_components.growhelper.grow_diary.async_set_active_grow_run") as mock_set_active:
                mock_create.return_value = ("new_run", MagicMock(spec=Path))
                
                run_name, file_path = await async_start_grow_run(
                    mock_hass, mock_config_entry, run_name="new_run"
                )
                
                assert run_name == "new_run"
                mock_set_active.assert_called_once_with(mock_hass, mock_config_entry, "new_run")


class TestPrototypeMigration:
    """Tests for migrating prototype entries."""

    @pytest.mark.asyncio
    async def test_migrate_prototype_entries_no_runs(
        self, mock_hass, mock_config_entry
    ):
        """Test migration when no Grow Runs exist."""
        with patch("custom_components.growhelper.grow_diary.async_list_grow_runs") as mock_list_runs:
            mock_list_runs.return_value = []

            with patch("custom_components.growhelper.grow_diary.async_create_grow_run") as mock_create:
                mock_create.return_value = ("grow_run_1", MagicMock(spec=Path))
                with patch("custom_components.growhelper.grow_diary.async_set_active_grow_run") as mock_set_active:
                    with patch("custom_components.growhelper.grow_diary.async_append_diary_entry") as mock_append:
                        result = await async_migrate_prototype_entries(mock_hass, mock_config_entry)

            # Should create first run and append prototype entries
            mock_create.assert_called_once()
            mock_set_active.assert_called_once()
            assert mock_append.call_count == 2  # Two prototype entries

    @pytest.mark.asyncio
    @patch("custom_components.growhelper.grow_diary.async_list_grow_runs")
    async def test_migrate_prototype_entries_existing_runs(
        self, mock_list_runs, mock_hass, mock_config_entry
    ):
        """Test that migration is skipped when Grow Runs already exist."""
        mock_list_runs.return_value = ["existing_run"]
        
        result = await async_migrate_prototype_entries(mock_hass, mock_config_entry)
        
        assert result is None


class TestDiaryContentReading:
    """Tests for reading diary content."""

    @pytest.mark.asyncio
    @patch("custom_components.growhelper.grow_diary._get_diary_file_path")
    async def test_get_diary_content_success(
        self, mock_get_path, mock_hass
    ):
        """Test reading diary content successfully."""
        mock_file_path = MagicMock(spec=Path)
        mock_file_path.exists.return_value = True
        mock_get_path.return_value = mock_file_path
        
        mock_file_path.read_text.return_value = "# Test content"
        result = await async_get_diary_content(mock_hass, "test_run")
        
        assert result == "# Test content"

    @pytest.mark.asyncio
    @patch("custom_components.growhelper.grow_diary._get_diary_file_path")
    async def test_get_diary_content_not_found(
        self, mock_get_path, mock_hass
    ):
        """Test reading diary content when file doesn't exist."""
        mock_file_path = MagicMock(spec=Path)
        mock_file_path.exists.return_value = False
        mock_get_path.return_value = mock_file_path
        
        with pytest.raises(FileNotFoundError):
            await async_get_diary_content(mock_hass, "nonexistent_run")


class TestADR0001FormatCompliance:
    """Tests to ensure ADR-0001 format compliance."""

    @pytest.mark.asyncio
    @patch("custom_components.growhelper.grow_diary.async_get_active_grow_run")
    @patch("custom_components.growhelper.grow_diary._get_diary_file_path")
    async def test_entry_format_compliance(
        self, mock_get_path, mock_get_active, mock_hass, mock_config_entry
    ):
        """Test that appended entries follow ADR-0001 format."""
        mock_get_active.return_value = "test_run"
        mock_file_path = MagicMock(spec=Path)
        mock_file_path.exists.return_value = True
        mock_get_path.return_value = mock_file_path
        
        mock_file_path.read_text.return_value = ""
        await async_append_diary_entry(
            mock_hass,
            mock_config_entry,
            note="Test note",
            plant_tag="Plant 1",
            event_title="Test Event",
        )
        
        # Get the written content
        written_content = mock_file_path.write_text.call_args[0][0]
        
        # Verify ADR-0001 format elements are present
        assert DIARY_DATE_HEADER_PREFIX in written_content
        assert DIARY_EVENT_SUBHEADER_PREFIX in written_content
        assert DIARY_ENTRY_BULLET_PREFIX in written_content
        assert "[Plant 1]" in written_content
        assert "Test note" in written_content
        assert DIARY_ENTRY_SEPARATOR in written_content
