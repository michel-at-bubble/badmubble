// Generic validation of `Matches` records.
//
// Input records are plain objects keyed by column header with string values,
// as produced by parsing the worksheet's CSV export. Nothing here depends on a
// particular season (number of coaches, rounds or dates).
//
// Invalid data is reported, never silently corrected. The only normalisation
// is trimming surrounding whitespace.

import {
  ALWAYS_REQUIRED_FIELDS,
  MATCH_COLUMNS,
  PHASES,
  PLAYOFF_PHASES,
  RESULT_FIELDS,
  RESULT_STATUS,
  SLOT_PATTERN,
} from "./match-contract.js";

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const NON_NEGATIVE_INTEGER_PATTERN = /^\d+$/;

const SIDES = Object.freeze([
  { name: "home", coach: "home_coach", slot: "home_slot" },
  { name: "away", coach: "away_coach", slot: "away_slot" },
]);

/**
 * @typedef {object} ValidationIssue
 * @property {number|null} row      row number of the record (see validateMatches), or null for header issues
 * @property {string|null} matchId
 * @property {string|null} field
 * @property {string} code
 * @property {string} message
 */

function text(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function issue(row, matchId, field, code, message) {
  return { row, matchId: matchId || null, field, code, message };
}

/** Reports contract columns that are missing from the worksheet header. */
export function validateHeaders(headers) {
  const present = new Set(headers.map(text));
  return MATCH_COLUMNS.filter((column) => !present.has(column)).map((column) =>
    issue(null, null, column, "missing-column", `Column "${column}" is missing.`),
  );
}

/** Classifies how much of the result has been entered, based on the four TD/CAS fields. */
export function getResultStatus(record) {
  const filled = RESULT_FIELDS.filter((field) => text(record[field]) !== "").length;
  if (filled === 0) return RESULT_STATUS.NONE;
  if (filled === RESULT_FIELDS.length) return RESULT_STATUS.COMPLETE;
  return RESULT_STATUS.PARTIAL;
}

function isValidMonth(value) {
  const match = MONTH_PATTERN.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

function isValidDate(value) {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validates a single record in isolation.
 * @param {Record<string, string>} record
 * @param {number} rowNumber 1-based data row number, used in issue reports
 * @returns {{ match: object, issues: ValidationIssue[] }}
 */
export function validateMatch(record, rowNumber) {
  const issues = [];
  const values = Object.fromEntries(MATCH_COLUMNS.map((column) => [column, text(record[column])]));
  const matchId = values.match_id;
  const report = (field, code, message) =>
    issues.push(issue(rowNumber, matchId, field, code, message));

  for (const field of ALWAYS_REQUIRED_FIELDS) {
    if (values[field] === "") report(field, "missing-required", `"${field}" is required.`);
  }

  const phase = values.phase;
  const isGroup = phase === PHASES.GROUP;
  const isPlayoff = PLAYOFF_PHASES.includes(phase);
  if (phase !== "" && !isGroup && !isPlayoff) {
    report("phase", "invalid-phase", `Unknown phase "${phase}".`);
  }

  if (values.scheduled_month !== "" && !isValidMonth(values.scheduled_month)) {
    report("scheduled_month", "invalid-month", `"${values.scheduled_month}" is not a YYYY-MM month.`);
  }

  if (values.match_date !== "" && !isValidDate(values.match_date)) {
    report("match_date", "invalid-date", `"${values.match_date}" is not a valid YYYY-MM-DD date.`);
  }

  for (const side of SIDES) {
    const coach = values[side.coach];
    const slot = values[side.slot];

    if (slot !== "" && isGroup) {
      report(side.slot, "slot-not-allowed", "Group matches must not have qualification slots.");
    } else if (slot !== "" && !SLOT_PATTERN.test(slot)) {
      report(side.slot, "invalid-slot", `"${slot}" is not a valid slot (use group:N or winner:<match_id>).`);
    }

    if (coach === "") {
      if (isGroup) {
        report(side.coach, "missing-required", `"${side.coach}" is required for group matches.`);
      } else if (isPlayoff && slot === "") {
        report(side.coach, "missing-participant", `The ${side.name} side needs a coach or a slot.`);
      }
    }
  }

  if (
    values.home_coach !== "" &&
    values.home_coach.toLowerCase() === values.away_coach.toLowerCase()
  ) {
    report("away_coach", "same-coach", "A coach cannot play against themselves.");
  }

  const scores = {};
  for (const field of RESULT_FIELDS) {
    const raw = values[field];
    if (raw === "") {
      scores[field] = null;
    } else if (NON_NEGATIVE_INTEGER_PATTERN.test(raw)) {
      scores[field] = Number(raw);
    } else {
      scores[field] = null;
      report(field, "invalid-score", `"${raw}" is not a non-negative integer.`);
    }
  }

  const resultStatus = getResultStatus(values);
  if (resultStatus !== RESULT_STATUS.NONE && (values.home_coach === "" || values.away_coach === "")) {
    report(null, "result-without-coaches", "A result is entered but not both coaches are known.");
  }

  if (values.ruleset_url !== "" && !isValidHttpUrl(values.ruleset_url)) {
    report("ruleset_url", "invalid-url", `"${values.ruleset_url}" is not an http(s) URL.`);
  }

  const match = { ...values, ...scores, row: rowNumber, resultStatus };
  return { match, issues };
}

/**
 * Validates all records, including checks that span rows.
 * @param {Record<string, string>[]} records
 * @param {number[]} [rowNumbers] row number reported for each record; defaults to 1, 2, 3, …
 *   The data layer passes spreadsheet row numbers so issues point at the row the administrator sees.
 * @returns {{ matches: object[], issues: ValidationIssue[] }}
 */
export function validateMatches(records, rowNumbers = records.map((_, index) => index + 1)) {
  const matches = [];
  const issues = [];

  records.forEach((record, index) => {
    const result = validateMatch(record, rowNumbers[index]);
    matches.push(result.match);
    issues.push(...result.issues);
  });

  const firstRowById = new Map();
  for (const match of matches) {
    if (match.match_id === "") continue;
    if (firstRowById.has(match.match_id)) {
      issues.push(
        issue(
          match.row,
          match.match_id,
          "match_id",
          "duplicate-id",
          `match_id "${match.match_id}" is already used on row ${firstRowById.get(match.match_id)}.`,
        ),
      );
    } else {
      firstRowById.set(match.match_id, match.row);
    }
  }

  // Coaches are identified by their exact name, so spellings that differ only in
  // case or spacing would silently split one coach into two.
  const firstSpelling = new Map();
  for (const match of matches) {
    for (const side of SIDES) {
      const name = match[side.coach];
      if (name === "") continue;
      const key = name.toLowerCase().replace(/\s+/g, " ");
      if (!firstSpelling.has(key)) {
        firstSpelling.set(key, { name, row: match.row });
      } else if (firstSpelling.get(key).name !== name) {
        const first = firstSpelling.get(key);
        issues.push(
          issue(
            match.row,
            match.match_id,
            side.coach,
            "inconsistent-coach-name",
            `"${name}" is spelled differently from "${first.name}" on row ${first.row}.`,
          ),
        );
      }
    }
  }

  for (const match of matches) {
    for (const side of SIDES) {
      const slotMatch = SLOT_PATTERN.exec(match[side.slot]);
      const referencedId = slotMatch?.[2];
      if (referencedId === undefined) continue;
      if (!firstRowById.has(referencedId)) {
        issues.push(
          issue(match.row, match.match_id, side.slot, "unknown-slot-match", `No match with match_id "${referencedId}".`),
        );
      } else if (referencedId === match.match_id) {
        issues.push(
          issue(match.row, match.match_id, side.slot, "invalid-slot", "A match cannot reference its own winner."),
        );
      }
    }
  }

  return { matches, issues };
}
