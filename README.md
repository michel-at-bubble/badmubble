# Badmubble

Website for **Badmubble**, a small round-robin Blood Bowl league in the Blood-Bowl.nl ecosystem.

Will be hosted at `https://badmubble.blood-bowl.nl` (GitHub Pages; not configured yet).

## Source of truth

All competition data comes from a Google Sheet that the league administrator maintains: coaches, schedule, dates, races, rulesets, results and playoffs. The website is public and read-only.

- No competition data is stored in this repository.
- Changing the schedule or results in the sheet never requires a code change.
- The sheet structure is defined in [docs/data-contract.md](docs/data-contract.md). An empty template is in [templates/matches-template.csv](templates/matches-template.csv).

## Architecture

Static HTML, CSS and vanilla JavaScript (ES modules), with no backend, framework, build step or runtime dependencies.

```
index.html                  page shell
css/                        project-specific styling
images/                     logo (512 px web version) and favicons
js/domain/                  pure logic: data contract, validation (no DOM, no network)
docs/                       data contract
templates/                  empty spreadsheet template (headers only)
tests/                      automated tests and synthetic fixtures
```

Planned layers, added when needed:

- `js/data/`: fetching and parsing the Google Sheet CSV export.
- `js/ui/`: rendering.

Dependencies flow `ui → domain ← data`. Domain code imports nothing outside `js/domain/`.

## Repository responsibilities

This repository contains the Badmubble application: page structure, project-specific styling, the data contract and league logic.

It does not contain competition data, shared assets (these belong in `blood-bowl-nl-assets`) or engineering guidelines (these belong in `blood-bowl-engineering`).

## Local development

From the workspace root (`blood-bowl-nl/`), start the shared development server:

```
py -m http.server 8000
```

Then open http://localhost:8000/badmubble/.

## Tests

Tests use the built-in Node.js test runner (Node 20 or newer) and need no installation:

```
npm test
```

or `node --test`. Test data in `tests/fixtures/` is synthetic (`Coach A`, `TEST-G01`, …) and is not competition data.

## Status

Phase 1 is done: repository skeleton, `Matches` data contract, spreadsheet template, match validation and tests.

Not yet implemented: Google Sheets connection, standings, tiebreakers, playoff qualification, user interface, deployment.
