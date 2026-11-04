# Badmubble

Website for the **Bad Mubble League** (repository: `badmubble`), a small round-robin Blood Bowl league in the Blood-Bowl.nl ecosystem.

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
js/config.js                which spreadsheet and worksheet to read
js/data/                    fetching and parsing the sheet's CSV export
js/domain/                  pure logic: data contract, validation (no DOM, no network)
docs/                       data contract
scripts/                    development helpers
templates/                  empty spreadsheet template (headers only)
tests/                      automated tests and synthetic fixtures
```

`js/ui/` (rendering) will be added with the first page that shows data.

Dependencies flow `ui → data → domain`. Domain code imports nothing outside `js/domain/`.

The data is read from the sheet's plain CSV export (`/export?format=csv&gid=…`). The `gviz` endpoint is deliberately not used: it infers one type per column and empties cells that do not match (for example `SF` in a mostly numeric `round` column).

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

or `node --test`. Tests never access the network. Test data is synthetic (`Coach A`, `TEST-G01`, …) and is not competition data.

## Checking the sheet

To validate the live sheet and list problems by spreadsheet row:

```
npm run check-sheet
```

It exits with code 1 if there are data issues and 2 if the sheet cannot be loaded.

## Status

Done:
- Phase 1: repository skeleton, `Matches` data contract, spreadsheet template, match validation.
- Phase 2: reading the sheet (CSV export, parser, loader), `check-sheet` helper.

Not yet implemented: user interface (bilingual NL/EN), standings, tiebreakers, playoff qualification, deployment.
