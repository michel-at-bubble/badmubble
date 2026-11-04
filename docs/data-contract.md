# Data contract: `Matches` worksheet

Google Sheets is the single source of truth for Badmubble competition data. The website only reads it.

All competition data lives in one worksheet named `Matches`. Each row is one match, from the regular season or the playoffs. The participating coaches are derived from the matches; there is no separate coach list.

An empty template with the column headers is available at [`templates/matches-template.csv`](../templates/matches-template.csv). The contract is implemented in code in [`js/domain/match-contract.js`](../js/domain/match-contract.js); keep the two in sync.

## Columns

| Column | Type | Required | Description |
|---|---|---|---|
| `match_id` | text | always | Stable, unique identifier, e.g. `G01`, `SF1`, `F`. Never change or reuse it once published. |
| `phase` | `group`, `semifinal` or `final` | always | Competition phase, lowercase. |
| `round` | text | always | Round label, e.g. `1`, `2`, `SF`, `F`. |
| `scheduled_month` | `YYYY-MM` | always | Month in which the match is scheduled. |
| `match_date` | `YYYY-MM-DD` | no | Date of the match: planned in advance or filled in afterwards. Shown as "scheduled for" until the result is complete, then as "played on". Once the date has passed (Dutch time, Europe/Amsterdam) without any result entered, the match shows "result to follow". |
| `home_slot` | slot | playoffs only | Where the home participant qualifies from (see below). |
| `home_coach` | text | group: always; playoffs: once known | Coach name. |
| `home_race` | text | no | Race chosen by the home coach. |
| `away_slot` | slot | playoffs only | Where the away participant qualifies from. |
| `away_coach` | text | group: always; playoffs: once known | Coach name. |
| `away_race` | text | no | Race chosen by the away coach. |
| `home_td` | non-negative integer | no | Touchdowns scored by home. |
| `away_td` | non-negative integer | no | Touchdowns scored by away. |
| `home_cas` | non-negative integer | no | Casualties caused by home, as supplied by the administrator. |
| `away_cas` | non-negative integer | no | Casualties caused by away, as supplied by the administrator. |
| `ruleset_name` | text | no | Name of the tournament ruleset used. |
| `ruleset_url` | `http(s)` URL | no | Link to the ruleset. |

Home and away are administrative conventions only.

Column order does not matter to the application, and extra columns (for example `notes`) are allowed and ignored. A missing contract column is an error.

## Playoff matches

Playoff rows are entered at the start of the season, before their participants are known. Each side has a **slot** that records where the participant comes from:

| Slot | Meaning |
|---|---|
| `group:N` | Position N in the final group standings (N ≥ 1) |
| `winner:<match_id>` | Winner of the referenced match |

For the inaugural season this would be, for example:

| match_id | phase | round | home_slot | away_slot |
|---|---|---|---|---|
| `SF1` | `semifinal` | `SF` | `group:1` | `group:4` |
| `SF2` | `semifinal` | `SF` | `group:2` | `group:3` |
| `F` | `final` | `F` | `winner:SF1` | `winner:SF2` |

Once a participant is known, the administrator fills in the coach column and leaves the slot in place. The slot only records where a participant comes from. How group positions are determined (points, tiebreakers) is not part of this contract.

Group matches must not have slots.

## Result semantics

The four result fields are `home_td`, `away_td`, `home_cas` and `away_cas`.

| Status | Condition | Counts towards standings |
|---|---|---|
| `none` | All four empty | no |
| `partial` | One to three filled | no |
| `complete` | All four filled | yes, if the row has no validation issues |

- An empty cell means "not entered". `0` is a valid value.
- Values must be non-negative integers written as plain digits: `-1`, `1.5`, `2.0`, `+2` and `two` are invalid.
- A partial result is not an error, since a result may be entered in steps, but it never counts towards standings.

## Validation

Validation is generic: it does not assume a number of coaches, rounds or a particular season. Invalid data is **reported, not corrected**. The only normalisation is trimming whitespace around values.

| Code | Meaning |
|---|---|
| `missing-column` | A contract column is missing from the header. |
| `missing-required` | A required value is empty. |
| `missing-participant` | A playoff side has neither a coach nor a slot. |
| `invalid-phase` | `phase` is not `group`, `semifinal` or `final`. |
| `invalid-month` | `scheduled_month` is not a valid `YYYY-MM`. |
| `invalid-date` | `match_date` is not a valid calendar date in `YYYY-MM-DD`. |
| `invalid-score` | A result value is not a non-negative integer. |
| `invalid-url` | `ruleset_url` is not an `http`/`https` URL. |
| `same-coach` | Home and away coach are the same (case-insensitive). |
| `invalid-slot` | Slot syntax is invalid, or a match references its own winner. |
| `slot-not-allowed` | A group match has a slot. |
| `unknown-slot-match` | A `winner:` slot references a `match_id` that does not exist. |
| `result-without-coaches` | A result value is entered while a coach is still unknown. |
| `duplicate-id` | `match_id` is used on more than one row. |
| `inconsistent-coach-name` | A coach name differs from an earlier row only in case or spacing (e.g. `Coach A` vs `coach a`). |

Matching of `match_id` values (duplicates and `winner:` references) is exact and case-sensitive.

Rows where every cell is empty are ignored. Every other row is validated. Issues refer to the spreadsheet row number, with the header as row 1. If a contract column is missing, only the missing columns are reported and rows are not validated.

Run `npm run check-sheet` to validate the live sheet.

## Spreadsheet practice

- Import the template via *File → Import → Upload*, then rename the worksheet to `Matches`.
- Format all columns as **Plain text** (*Format → Number → Plain text*). Otherwise Google Sheets converts `2026-01` and `2026-01-15` into dates and changes how they are exported. The application reports such values as invalid rather than guessing what was meant.
- Spell coach names the same way on every row. Names are compared as text, so a spelling difference creates a different coach. A data-validation dropdown in the sheet helps here.
- The sheet must be shared as "anyone with the link: viewer", otherwise the website cannot read it.
- The website reads the worksheet whose `gid` is set in `js/config.js` (currently `0`, the first worksheet). If the `Matches` worksheet is moved or recreated, check its `gid` (shown as `#gid=…` in the sheet URL).
