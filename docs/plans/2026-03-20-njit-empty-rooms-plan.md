# NJIT Empty Rooms Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a mobile-first Flask web app that shows which NJIT classrooms are currently empty and how long until the next class.

**Architecture:** Standard Flask layout with a `schedule.py` module for all pure-Python parsing and availability logic (keeping it testable without Flask), and `app.py` for routes only. Frontend is vanilla JS + HTML/CSS, no build step.

**Tech Stack:** Python 3, Flask, pandas, openpyxl, pytest, vanilla JS/HTML/CSS

---

## File Map

```
njit-empty-rooms/
  app.py                  # Flask routes only
  schedule.py             # Data parsing + room availability logic
  requirements.txt
  tests/
    __init__.py
    test_schedule.py      # Unit tests for parsing + availability
    test_api.py           # Flask test client tests
  templates/
    index.html
  static/
    style.css
    app.js
  Course_Schedule_All_Subjects.xlsx
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `njit-empty-rooms/` directory tree
- Create: `njit-empty-rooms/requirements.txt`
- Copy: Excel file from Downloads

**Step 1: Create the project directory and subdirectories**

```bash
mkdir -p njit-empty-rooms/templates njit-empty-rooms/static njit-empty-rooms/tests
```

**Step 2: Create requirements.txt**

```
flask
pandas
openpyxl
pytest
```

**Step 3: Copy the Excel file**

```bash
cp "C:/Users/georg/Downloads/Course_Schedule_All_Subjects.xlsx" njit-empty-rooms/
```

**Step 4: Create empty placeholder files**

```bash
touch njit-empty-rooms/app.py
touch njit-empty-rooms/schedule.py
touch njit-empty-rooms/tests/__init__.py
touch njit-empty-rooms/tests/test_schedule.py
touch njit-empty-rooms/tests/test_api.py
touch njit-empty-rooms/templates/index.html
touch njit-empty-rooms/static/style.css
touch njit-empty-rooms/static/app.js
```

**Step 5: Install dependencies**

```bash
cd njit-empty-rooms && pip install -r requirements.txt
```

Expected: All packages install without errors.

**Step 6: Commit scaffold**

```bash
git add njit-empty-rooms/
git commit -m "chore: scaffold NJIT Empty Rooms project"
```

---

### Task 2: Data Parsing (TDD)

**Files:**
- Write: `njit-empty-rooms/tests/test_schedule.py` (parsing section)
- Write: `njit-empty-rooms/schedule.py`

**Step 1: Write failing tests for parsing helpers**

Write `njit-empty-rooms/tests/test_schedule.py`:

```python
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
```

**Step 2: Run tests to verify they fail**

```bash
cd njit-empty-rooms
pytest tests/test_schedule.py -v
```

Expected: All FAIL with `ModuleNotFoundError: No module named 'schedule'`.

**Step 3: Implement `schedule.py` parsing functions**

Write `njit-empty-rooms/schedule.py`:

```python
import pandas as pd
from datetime import datetime
import warnings

DAY_MAP = {"M": 0, "T": 1, "W": 2, "R": 3, "F": 4, "S": 5}
VALID_MODES = {"Face-to-Face", "Hybrid"}


def parse_time_range(time_str):
    """Parse '1:00 PM - 2:20 PM' into (time, time). Returns None on failure."""
    if not time_str or not isinstance(time_str, str):
        return None
    parts = time_str.strip().split(" - ")
    if len(parts) != 2:
        return None
    try:
        start = datetime.strptime(parts[0].strip(), "%I:%M %p").time()
        end = datetime.strptime(parts[1].strip(), "%I:%M %p").time()
        return start, end
    except ValueError:
        return None


def parse_days(days_str):
    """Parse 'MWF' into [0, 2, 4]. Unknown codes are silently skipped."""
    if not days_str or not isinstance(days_str, str):
        return []
    return [DAY_MAP[ch] for ch in days_str.strip() if ch in DAY_MAP]


def parse_location(location_str):
    """Parse 'KUPF 207' into ('KUPF', '207'). Returns None if invalid."""
    if not location_str or not isinstance(location_str, str):
        return None
    stripped = location_str.strip()
    if not stripped:
        return None
    parts = stripped.split(" ", 1)
    if len(parts) < 2 or not parts[1].strip():
        return None
    return parts[0].strip(), parts[1].strip()


def load_schedule(xlsx_path):
    """
    Load and parse the Excel schedule file.
    Returns a list of dicts: building, room, days, time_start, time_end.
    Filters to Face-to-Face and Hybrid only. Skips rows with blank locations.
    """
    df = pd.read_excel(xlsx_path, dtype=str)
    df.columns = [c.strip() for c in df.columns]

    results = []
    for _, row in df.iterrows():
        mode = str(row.get("Delivery Mode", "")).strip()
        if mode not in VALID_MODES:
            continue

        loc = parse_location(str(row.get("Location", "")))
        if loc is None:
            continue
        building, room = loc

        days = parse_days(str(row.get("Days", "")))
        if not days:
            continue

        parsed = parse_time_range(str(row.get("Times", "")))
        if parsed is None:
            warnings.warn(f"Skipping row with unparseable time: {row.get('Times')}")
            continue
        time_start, time_end = parsed

        results.append({
            "building": building,
            "room": room,
            "days": days,
            "time_start": time_start,
            "time_end": time_end,
        })

    return results
```

**Step 4: Run parsing tests to verify they pass**

```bash
cd njit-empty-rooms
pytest tests/test_schedule.py -v
```

Expected: All PASS.

**Step 5: Commit**

```bash
git add njit-empty-rooms/schedule.py njit-empty-rooms/tests/test_schedule.py
git commit -m "feat: add schedule parsing with full test coverage"
```

---

### Task 3: Room Availability Logic (TDD)

**Files:**
- Modify: `njit-empty-rooms/tests/test_schedule.py` (append availability tests)
- Modify: `njit-empty-rooms/schedule.py` (add get_empty_rooms)

**Step 1: Append failing tests for get_empty_rooms to test_schedule.py**

Append to `njit-empty-rooms/tests/test_schedule.py`:

```python
from schedule import get_empty_rooms

MONDAY = 0

SAMPLE_SCHEDULE = [
    # KUPF 207: class 9am-10am and 1pm-2pm on Mon
    {"building": "KUPF", "room": "207", "days": [MONDAY], "time_start": time(9, 0),  "time_end": time(10, 0)},
    {"building": "KUPF", "room": "207", "days": [MONDAY], "time_start": time(13, 0), "time_end": time(14, 0)},
    # KUPF 315: class 10am-11am on Mon
    {"building": "KUPF", "room": "315", "days": [MONDAY], "time_start": time(10, 0), "time_end": time(11, 0)},
    # TIER 101: Tuesday only
    {"building": "TIER", "room": "101", "days": [1], "time_start": time(9, 0), "time_end": time(17, 0)},
]


class TestGetEmptyRooms:
    def test_occupied_room_excluded(self):
        # 9:30am Monday — KUPF 207 has class 9-10am, so it's occupied
        result = get_empty_rooms(SAMPLE_SCHEDULE, weekday=MONDAY, now=time(9, 30))
        rooms = [(r["building"], r["room"]) for r in result]
        assert ("KUPF", "207") not in rooms

    def test_empty_room_included(self):
        # 9:30am Monday — KUPF 315 is empty (its class is 10-11)
        result = get_empty_rooms(SAMPLE_SCHEDULE, weekday=MONDAY, now=time(9, 30))
        rooms = [(r["building"], r["room"]) for r in result]
        assert ("KUPF", "315") in rooms

    def test_minutes_until_next_correct(self):
        # 9:30am Monday — KUPF 315 next class at 10:00 = 30 min
        result = get_empty_rooms(SAMPLE_SCHEDULE, weekday=MONDAY, now=time(9, 30))
        kupf_315 = next(r for r in result if r["room"] == "315" and r["building"] == "KUPF")
        assert kupf_315["minutes_until_next"] == 30

    def test_minutes_until_next_null_when_no_more_classes(self):
        # 11:30am Monday — KUPF 315 had its only class at 10-11, done for today
        result = get_empty_rooms(SAMPLE_SCHEDULE, weekday=MONDAY, now=time(11, 30))
        kupf_315 = next(r for r in result if r["room"] == "315" and r["building"] == "KUPF")
        assert kupf_315["minutes_until_next"] is None

    def test_class_end_boundary_room_is_empty(self):
        # 10:00am exactly — KUPF 207's first class just ended, room is free until 1pm
        result = get_empty_rooms(SAMPLE_SCHEDULE, weekday=MONDAY, now=time(10, 0))
        rooms = [(r["building"], r["room"]) for r in result]
        assert ("KUPF", "207") in rooms

    def test_room_with_no_classes_today_appears_with_null(self):
        # TIER 101 has no Monday classes — appears as empty, free all day
        result = get_empty_rooms(SAMPLE_SCHEDULE, weekday=MONDAY, now=time(9, 30))
        tier = next((r for r in result if r["building"] == "TIER" and r["room"] == "101"), None)
        assert tier is not None
        assert tier["minutes_until_next"] is None

    def test_sorted_by_building_then_room(self):
        result = get_empty_rooms(SAMPLE_SCHEDULE, weekday=MONDAY, now=time(12, 0))
        buildings = [r["building"] for r in result]
        assert buildings == sorted(buildings)
        kupf_rooms = [r["room"] for r in result if r["building"] == "KUPF"]
        assert kupf_rooms == sorted(kupf_rooms)

    def test_building_filter(self):
        result = get_empty_rooms(SAMPLE_SCHEDULE, weekday=MONDAY, now=time(9, 30), building="KUPF")
        assert all(r["building"] == "KUPF" for r in result)

    def test_building_filter_no_match(self):
        result = get_empty_rooms(SAMPLE_SCHEDULE, weekday=MONDAY, now=time(9, 30), building="NONEXISTENT")
        assert result == []
```

**Step 2: Run tests to verify they fail**

```bash
cd njit-empty-rooms
pytest tests/test_schedule.py::TestGetEmptyRooms -v
```

Expected: All FAIL with `ImportError: cannot import name 'get_empty_rooms'`.

**Step 3: Append get_empty_rooms to schedule.py**

Append to `njit-empty-rooms/schedule.py`:

```python
def _time_to_minutes(t):
    return t.hour * 60 + t.minute


def get_empty_rooms(schedule, weekday, now, building=None):
    """
    Return all rooms currently empty as of (weekday, now).
    Each result: {"building", "room", "minutes_until_next"} (minutes is int or None).
    Sorted by building, then room. Optional building filter.
    """
    # Collect all unique rooms and their classes for today
    all_rooms = {}  # (building, room) -> [today's class entries]
    for entry in schedule:
        key = (entry["building"], entry["room"])
        if key not in all_rooms:
            all_rooms[key] = []
        if weekday in entry["days"]:
            all_rooms[key].append(entry)

    now_min = _time_to_minutes(now)
    results = []

    for (bldg, room), today_classes in all_rooms.items():
        if building and bldg != building:
            continue

        occupied = any(
            _time_to_minutes(c["time_start"]) <= now_min < _time_to_minutes(c["time_end"])
            for c in today_classes
        )
        if occupied:
            continue

        future = [c for c in today_classes if _time_to_minutes(c["time_start"]) > now_min]
        if future:
            nxt = min(future, key=lambda c: c["time_start"])
            minutes_until_next = _time_to_minutes(nxt["time_start"]) - now_min
        else:
            minutes_until_next = None

        results.append({"building": bldg, "room": room, "minutes_until_next": minutes_until_next})

    results.sort(key=lambda r: (r["building"], r["room"]))
    return results
```

**Step 4: Run all schedule tests**

```bash
cd njit-empty-rooms
pytest tests/test_schedule.py -v
```

Expected: All PASS.

**Step 5: Commit**

```bash
git add njit-empty-rooms/schedule.py njit-empty-rooms/tests/test_schedule.py
git commit -m "feat: add room availability logic with full test coverage"
```

---

### Task 4: Flask App + API Tests

**Files:**
- Write: `njit-empty-rooms/app.py`
- Write: `njit-empty-rooms/tests/test_api.py`

**Step 1: Write failing API tests**

Write `njit-empty-rooms/tests/test_api.py`:

```python
import pytest
from datetime import time
from unittest.mock import patch
from app import create_app

FAKE_SCHEDULE = [
    {"building": "KUPF", "room": "207", "days": [0], "time_start": time(13, 0), "time_end": time(14, 0)},
    {"building": "KUPF", "room": "315", "days": [0], "time_start": time(9, 0),  "time_end": time(10, 0)},
    {"building": "TIER", "room": "101", "days": [0], "time_start": time(9, 0),  "time_end": time(10, 0)},
]


@pytest.fixture
def client():
    app = create_app(schedule=FAKE_SCHEDULE)
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


class TestRoomsEndpoint:
    def test_returns_200(self, client):
        with patch("app.get_current_time", return_value=(0, time(12, 0))):
            resp = client.get("/api/rooms")
        assert resp.status_code == 200

    def test_returns_json_list(self, client):
        with patch("app.get_current_time", return_value=(0, time(12, 0))):
            resp = client.get("/api/rooms")
        assert isinstance(resp.get_json(), list)

    def test_occupied_room_not_in_response(self, client):
        # 1:30pm Monday — KUPF 207 is in class (1pm-2pm)
        with patch("app.get_current_time", return_value=(0, time(13, 30))):
            resp = client.get("/api/rooms")
        rooms = [(r["building"], r["room"]) for r in resp.get_json()]
        assert ("KUPF", "207") not in rooms

    def test_empty_room_in_response(self, client):
        # 12pm Monday — KUPF 315 is empty (class was 9-10am)
        with patch("app.get_current_time", return_value=(0, time(12, 0))):
            resp = client.get("/api/rooms")
        rooms = [(r["building"], r["room"]) for r in resp.get_json()]
        assert ("KUPF", "315") in rooms

    def test_building_filter(self, client):
        with patch("app.get_current_time", return_value=(0, time(12, 0))):
            resp = client.get("/api/rooms?building=KUPF")
        assert all(r["building"] == "KUPF" for r in resp.get_json())

    def test_response_fields(self, client):
        with patch("app.get_current_time", return_value=(0, time(12, 0))):
            resp = client.get("/api/rooms")
        data = resp.get_json()
        assert len(data) > 0
        for room in data:
            assert "building" in room
            assert "room" in room
            assert "minutes_until_next" in room

    def test_minutes_until_next_type(self, client):
        with patch("app.get_current_time", return_value=(0, time(12, 0))):
            resp = client.get("/api/rooms")
        for room in resp.get_json():
            assert room["minutes_until_next"] is None or isinstance(room["minutes_until_next"], int)

    def test_index_returns_html(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        assert b"<!DOCTYPE html>" in resp.data or b"<html" in resp.data
```

**Step 2: Run tests to verify they fail**

```bash
cd njit-empty-rooms
pytest tests/test_api.py -v
```

Expected: All FAIL with `ModuleNotFoundError: No module named 'app'`.

**Step 3: Write app.py**

Write `njit-empty-rooms/app.py`:

```python
import os
from datetime import datetime
from flask import Flask, jsonify, render_template, request
from schedule import load_schedule, get_empty_rooms


def get_current_time():
    """Returns (weekday_int, time_object). Separate function for testability."""
    now = datetime.now()
    return now.weekday(), now.time()


def create_app(schedule=None):
    app = Flask(__name__)

    if schedule is None:
        xlsx_path = os.path.join(os.path.dirname(__file__), "Course_Schedule_All_Subjects.xlsx")
        schedule = load_schedule(xlsx_path)
        print(f"Loaded {len(schedule)} schedule entries.")

    @app.route("/")
    def index():
        return render_template("index.html")

    @app.route("/api/rooms")
    def rooms():
        weekday, now = get_current_time()
        building = request.args.get("building") or None
        result = get_empty_rooms(schedule, weekday=weekday, now=now, building=building)
        return jsonify(result)

    return app


if __name__ == "__main__":
    application = create_app()
    application.run(debug=True, port=5000)
```

**Step 4: Run API tests**

```bash
cd njit-empty-rooms
pytest tests/test_api.py -v
```

Expected: All PASS except `test_index_returns_html` (index.html still empty — fixed in Task 5).

**Step 5: Commit**

```bash
git add njit-empty-rooms/app.py njit-empty-rooms/tests/test_api.py
git commit -m "feat: add Flask app with /api/rooms endpoint and API tests"
```

---

### Task 5: Frontend HTML + CSS

**Files:**
- Write: `njit-empty-rooms/templates/index.html`
- Write: `njit-empty-rooms/static/style.css`

**Step 1: Write index.html**

Write `njit-empty-rooms/templates/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NJIT Empty Rooms</title>
  <link rel="stylesheet" href="/static/style.css" />
</head>
<body>
  <header>
    <h1>NJIT Empty Rooms</h1>
    <p class="clock" id="clock">--:-- --</p>
  </header>

  <main>
    <div class="controls">
      <label for="building-filter">Building</label>
      <select id="building-filter">
        <option value="">All Buildings</option>
      </select>
    </div>

    <p class="status" id="status"></p>

    <div class="rooms" id="rooms-container">
      <p class="loading">Loading rooms...</p>
    </div>
  </main>

  <script src="/static/app.js"></script>
</body>
</html>
```

**Step 2: Write style.css**

Write `njit-empty-rooms/static/style.css`:

```css
:root {
  --bg: #f4f5f7;
  --surface: #ffffff;
  --primary: #cc0000;
  --text: #1a1a1a;
  --text-muted: #666;
  --border: #e0e0e0;
  --badge-bg: #e8f5e9;
  --badge-text: #2e7d32;
  --soon-text: #f57f17;
  --radius: 12px;
  --shadow: 0 2px 8px rgba(0,0,0,0.08);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
}

header {
  background: var(--primary);
  color: #fff;
  padding: 20px 16px 16px;
  text-align: center;
}

header h1 { font-size: 1.4rem; font-weight: 700; }

.clock {
  font-size: 1.1rem;
  margin-top: 6px;
  opacity: 0.9;
  font-variant-numeric: tabular-nums;
}

main {
  max-width: 640px;
  margin: 0 auto;
  padding: 16px;
}

.controls {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.controls label { font-weight: 600; font-size: 0.9rem; white-space: nowrap; }

.controls select {
  flex: 1;
  padding: 8px 32px 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  font-size: 0.95rem;
  color: var(--text);
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23666' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  cursor: pointer;
}

.status { font-size: 0.82rem; color: var(--text-muted); margin-bottom: 12px; }

.rooms { display: grid; grid-template-columns: 1fr; gap: 10px; }

@media (min-width: 480px) { .rooms { grid-template-columns: 1fr 1fr; } }

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.card-room { font-size: 1.15rem; font-weight: 700; }
.card-building { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; }

.card-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  width: fit-content;
  background: var(--badge-bg);
  color: var(--badge-text);
}

.card-time { font-size: 0.85rem; color: var(--text-muted); }
.card-time.soon { color: var(--soon-text); font-weight: 600; }

.loading, .empty-state {
  color: var(--text-muted);
  text-align: center;
  padding: 40px 0;
  grid-column: 1 / -1;
}

.error-state {
  color: var(--primary);
  text-align: center;
  padding: 40px 0;
  grid-column: 1 / -1;
}
```

**Step 3: Verify the index HTML test now passes**

```bash
cd njit-empty-rooms
pytest tests/test_api.py::TestRoomsEndpoint::test_index_returns_html -v
```

Expected: PASS.

**Step 4: Run full test suite**

```bash
cd njit-empty-rooms
pytest -v
```

Expected: All PASS.

**Step 5: Commit**

```bash
git add njit-empty-rooms/templates/index.html njit-empty-rooms/static/style.css
git commit -m "feat: add HTML template and mobile-first CSS"
```

---

### Task 6: Frontend JavaScript

**Files:**
- Write: `njit-empty-rooms/static/app.js`

**IMPORTANT — XSS safety:** All dynamic content must be set via `textContent` or safe DOM methods, never via `innerHTML` with interpolated data. Room names come from the server but should still be treated as untrusted.

**Step 1: Write app.js**

Write `njit-empty-rooms/static/app.js`:

```javascript
const clockEl = document.getElementById('clock');
const filterEl = document.getElementById('building-filter');
const containerEl = document.getElementById('rooms-container');
const statusEl = document.getElementById('status');

let currentBuilding = '';
let knownBuildings = new Set();

// ── Clock ──────────────────────────────────────────────────────────────────

function updateClock() {
  clockEl.textContent = new Date().toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}
updateClock();
setInterval(updateClock, 1000);

// ── DOM helpers ────────────────────────────────────────────────────────────

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function text(tag, className, content) {
  const node = el(tag, className);
  node.textContent = content;
  return node;
}

// ── Render ─────────────────────────────────────────────────────────────────

function formatTimeUntil(minutes) {
  if (minutes === null || minutes === undefined) return 'Free for rest of day';
  if (minutes < 60) return `Next class in ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `Next class in ${h}h${m > 0 ? ' ' + m + 'm' : ''}`;
}

function makeCard(room) {
  const card = el('div', 'card');

  card.appendChild(text('div', 'card-building', room.building));
  card.appendChild(text('div', 'card-room', `${room.building} ${room.room}`));

  const badge = text('span', 'card-badge', 'Empty now');
  card.appendChild(badge);

  const isSoon = room.minutes_until_next !== null && room.minutes_until_next <= 30;
  const timeEl = text('div', isSoon ? 'card-time soon' : 'card-time', formatTimeUntil(room.minutes_until_next));
  card.appendChild(timeEl);

  return card;
}

function renderRooms(rooms) {
  containerEl.textContent = '';  // clear safely

  if (!rooms || rooms.length === 0) {
    containerEl.appendChild(text('p', 'empty-state', 'No empty rooms found right now.'));
    return;
  }

  rooms.forEach(room => containerEl.appendChild(makeCard(room)));
}

function updateBuildingDropdown(rooms) {
  const incoming = rooms.map(r => r.building).filter(b => !knownBuildings.has(b));
  if (incoming.length === 0) return;
  incoming.forEach(b => knownBuildings.add(b));

  const sorted = [...knownBuildings].sort();
  filterEl.textContent = '';  // clear safely

  const all = document.createElement('option');
  all.value = '';
  all.textContent = 'All Buildings';
  filterEl.appendChild(all);

  sorted.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b;
    opt.textContent = b;
    if (b === currentBuilding) opt.selected = true;
    filterEl.appendChild(opt);
  });
}

function updateStatus(count) {
  const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  statusEl.textContent = `${count} empty room${count !== 1 ? 's' : ''} \u00b7 Updated ${t}`;
}

// ── Fetch ──────────────────────────────────────────────────────────────────

async function fetchRooms() {
  const url = currentBuilding
    ? `/api/rooms?building=${encodeURIComponent(currentBuilding)}`
    : '/api/rooms';

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const rooms = await resp.json();
    renderRooms(rooms);
    updateBuildingDropdown(rooms);
    updateStatus(rooms.length);
  } catch (err) {
    containerEl.textContent = '';
    containerEl.appendChild(text('p', 'error-state', 'Could not load rooms. Is the server running?'));
    console.error('Fetch error:', err);
  }
}

// ── Init ───────────────────────────────────────────────────────────────────

filterEl.addEventListener('change', () => {
  currentBuilding = filterEl.value;
  fetchRooms();
});

fetchRooms();
setInterval(fetchRooms, 60_000);
```

**Step 2: Run full test suite**

```bash
cd njit-empty-rooms
pytest -v
```

Expected: All PASS.

**Step 3: Commit**

```bash
git add njit-empty-rooms/static/app.js
git commit -m "feat: add vanilla JS frontend with safe DOM rendering and auto-refresh"
```

---

### Task 7: End-to-End Verification

**Step 1: Start the app**

```bash
cd njit-empty-rooms
python app.py
```

Expected:
```
Loaded XXXX schedule entries.
 * Running on http://127.0.0.1:5000
```

**Step 2: Check the API**

```bash
curl http://localhost:5000/api/rooms | python -m json.tool | head -30
```

Expected: JSON array of objects with `building`, `room`, `minutes_until_next`.

**Step 3: Check building filter**

```bash
curl "http://localhost:5000/api/rooms?building=KUPF" | python -m json.tool
```

Expected: Only KUPF buildings in the result.

**Step 4: Open the browser**

Navigate to `http://localhost:5000`. Verify:
- Clock ticks in real time
- Building dropdown populates from live data
- Room cards display with correct status
- Selecting a building filters correctly
- Page auto-refreshes every 60 seconds

**Step 5: Final commit**

```bash
git add .
git commit -m "chore: complete NJIT Empty Rooms — all tasks done"
```
