import pytest
import os
from datetime import time
from schedule import parse_time_range, parse_days, parse_location, load_schedule


class TestParseTimeRange:
    def test_parses_pm_times(self):
        start, end = parse_time_range("1:00 PM - 2:20 PM")
        assert start == time(13, 0)
        assert end == time(14, 20)

    def test_parses_am_times(self):
        start, end = parse_time_range("8:30 AM - 9:50 AM")
        assert start == time(8, 30)
        assert end == time(9, 50)

    def test_parses_noon(self):
        start, end = parse_time_range("12:00 PM - 1:20 PM")
        assert start == time(12, 0)
        assert end == time(13, 20)

    def test_returns_none_on_tba(self):
        assert parse_time_range("TBA") is None

    def test_returns_none_on_empty(self):
        assert parse_time_range("") is None


class TestParseDays:
    def test_mwf(self):
        assert parse_days("MWF") == [0, 2, 4]

    def test_tr(self):
        assert parse_days("TR") == [1, 3]

    def test_monday_only(self):
        assert parse_days("M") == [0]

    def test_saturday(self):
        assert parse_days("S") == [5]

    def test_all_days(self):
        assert parse_days("MTWRFS") == [0, 1, 2, 3, 4, 5]

    def test_unknown_code_skipped(self):
        assert parse_days("MU") == [0]


class TestParseLocation:
    def test_standard_location(self):
        assert parse_location("KUPF 207") == ("KUPF", "207")

    def test_different_building(self):
        assert parse_location("TIER 101") == ("TIER", "101")

    def test_building_with_room_letters(self):
        assert parse_location("ECEC 100A") == ("ECEC", "100A")

    def test_returns_none_on_blank(self):
        assert parse_location("") is None
        assert parse_location("   ") is None

    def test_returns_none_on_single_token(self):
        assert parse_location("KUPF") is None


class TestLoadSchedule:
    def _xlsx(self):
        return os.path.join(os.path.dirname(__file__), "..", "Course_Schedule_All_Subjects.xlsx")

    def test_returns_list(self):
        if not os.path.exists(self._xlsx()):
            pytest.skip("Excel file not present")
        result = load_schedule(self._xlsx())
        assert isinstance(result, list)
        assert len(result) > 0

    def test_each_entry_has_required_keys(self):
        if not os.path.exists(self._xlsx()):
            pytest.skip("Excel file not present")
        result = load_schedule(self._xlsx())
        for entry in result[:20]:
            assert "building" in entry
            assert "room" in entry
            assert "days" in entry
            assert "time_start" in entry
            assert "time_end" in entry

    def test_no_blank_locations(self):
        if not os.path.exists(self._xlsx()):
            pytest.skip("Excel file not present")
        result = load_schedule(self._xlsx())
        for entry in result:
            assert entry["building"].strip() != ""
            assert entry["room"].strip() != ""

    def test_all_days_are_valid_weekday_ints(self):
        if not os.path.exists(self._xlsx()):
            pytest.skip("Excel file not present")
        result = load_schedule(self._xlsx())
        for entry in result:
            for d in entry["days"]:
                assert 0 <= d <= 5
