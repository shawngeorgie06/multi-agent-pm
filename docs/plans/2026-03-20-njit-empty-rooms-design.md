# NJIT Empty Rooms — Design Document

**Date:** 2026-03-20
**Status:** Approved

## Overview

A mobile-first web app that shows NJIT students which classrooms are currently empty and how long until the next class starts. Data comes from a pre-loaded Excel schedule file parsed at startup and cached in memory.

## Architecture

**Option A — Standard Flask layout (chosen)**

```
njit-empty-rooms/
  app.py                          # Flask app, data parsing, API routes
  requirements.txt
  templates/
    index.html                    # Single-page UI (served by Flask)
  static/
    style.css                     # Mobile-first styles
    app.js                        # Vanilla JS — fetch, render, auto-refresh
  Course_Schedule_All_Subjects.xlsx
```

No database. No build step. No JS framework. Runs with `python app.py` or `flask run`.

## Data Layer

### Source
`Course_Schedule_All_Subjects.xlsx` — loaded once at startup with pandas, stored in memory as a list of dicts.

### Relevant columns
- `Days` — day codes: M, T, W, R (Thursday), F, S
- `Times` — format: `1:00 PM - 2:20 PM`
- `Location` — format: `KUPF 207` (building = everything before first space)
- `Delivery Mode` — keep only `Face-to-Face` and `Hybrid`

### Filtering
- Drop rows where `Delivery Mode` is not Face-to-Face or Hybrid
- Drop rows where `Location` is blank or whitespace-only

### Parsing
- Split `Times` into `time_start` and `time_end` as `datetime.time` objects
- Split `Days` string into individual day codes (e.g. `"MWF"` → `['M','W','F']`)
- Day code → Python `weekday()` mapping: M=0, T=1, W=2, R=3, F=4, S=5
- Split `Location` into `building` (before first space) and `room` (after first space)

### In-memory structure
```python
SCHEDULE = [
    {
        "building": "KUPF",
        "room": "207",
        "days": [0, 2, 4],        # Mon, Wed, Fri
        "time_start": time(13, 0),
        "time_end": time(14, 20),
    },
    ...
]
```

## API

### `GET /api/rooms`
Returns all currently empty rooms.

**Query params:**
- `building` (optional) — filter to one building, e.g. `?building=KUPF`

**Algorithm (per request):**
1. Get current weekday integer and current time
2. For each unique room in SCHEDULE, collect all classes scheduled for today
3. A room is **occupied** if `time_start <= now < time_end` for any today class
4. A room is **empty** if no class is active right now
5. For empty rooms: find the next class starting today where `time_start > now`
6. `minutes_until_next` = `(next_start - now).seconds // 60`, or `null` if none

**Response:**
```json
[
  {
    "building": "KUPF",
    "room": "207",
    "minutes_until_next": 45
  },
  {
    "building": "KUPF",
    "room": "315",
    "minutes_until_next": null
  }
]
```

Sorted by building (alphabetical), then room (alphabetical).

### `GET /`
Serves `templates/index.html`.

## Frontend

### `templates/index.html`
- Single HTML file, no JS framework
- Links to `static/style.css` and `static/app.js`
- Contains: clock element, building dropdown, rooms container div

### `static/app.js`
- On DOMContentLoaded: fetch `/api/rooms`, render cards, populate building dropdown
- Building dropdown `change` event: re-fetch with `?building=X`
- `setInterval` every 1000ms: update displayed clock
- `setInterval` every 60000ms: re-fetch rooms and re-render

**Card render logic:**
- Room label: `KUPF 207`
- Status: "Empty now" badge
- Time info: "Next class in 45 min" or "Free for rest of day"

### `static/style.css`
- Mobile-first, max-width 640px centered
- CSS custom properties for colors
- Card grid (single column on mobile, 2-col on wider screens)
- Clean sans-serif typography, sufficient contrast
- No external fonts or CDN dependencies

## Edge Cases

| Scenario | Handling |
|---|---|
| Room only in filtered-out rows | Never appears in output |
| Class ends exactly at now | Room treated as empty (`time_end <= now`) |
| No classes today for a room | Room appears as empty, `minutes_until_next: null` |
| Sunday | No classes; all rooms empty, all `null` |
| Malformed time string | Caught at parse time, row skipped with warning |

## Deployment

- `requirements.txt`: `flask`, `pandas`, `openpyxl`
- Excel file must be in same directory as `app.py`
- Run: `python app.py` (debug mode, port 5000) or `flask run`
- No environment variables required
