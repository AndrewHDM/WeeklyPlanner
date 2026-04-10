# Weekly Planner MVP

A mobile-first, local-first weekly planning app for personal weekly reset workflows.

## What this MVP includes

- Stores recurring commitments in localStorage.
- Captures weekly reset input in a clean form.
- Generates:
  - detailed planning brief
  - Monk Manual copy block
  - suggested workout plan
- Enforces core rules:
  - travel weeks reduce intensity
  - overloaded weeks prioritize minimum viable sessions
  - low recovery/high stress avoids forced volume
  - consistency is prioritized over perfect volume

## Setup

1. Open a terminal in this folder.
2. Start a local web server:

   ```bash
   python3 -m http.server 8080
   ```

3. Open `http://localhost:8080` in your browser.

> Note: Loading via `file://` may block `rules.config.json` from being read in some browsers.

## Editable rules/config

You can change behavior in `rules.config.json`:

- `travelIntensityMultiplier`
- `overloadedWeekUsesMinimumViable`
- `lowRecoveryThreshold`
- `highStressThreshold`
- `prioritizeConsistency`
- output heading templates

## Architecture notes (future calendar sync)

Current layers:

- `index.html` + `styles.css`: UI layer
- `app.js`: state + rule engine + output generators
- `localStorage`: persistence layer
- `rules.config.json`: configurable policy layer

This separation allows a future integration layer (calendar API sync) to be added without replacing the rules engine or UI structure.
