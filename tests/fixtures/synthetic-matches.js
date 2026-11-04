// Synthetic test records. These are NOT competition data: all names, races,
// identifiers and URLs are placeholders that exist only for automated tests.

import { MATCH_COLUMNS } from "../../js/domain/match-contract.js";

/** Builds a record with every contract column present (empty by default). */
export function record(overrides = {}) {
  const base = Object.fromEntries(MATCH_COLUMNS.map((column) => [column, ""]));
  return { ...base, ...overrides };
}

export function groupMatch(overrides = {}) {
  return record({
    match_id: "TEST-G01",
    phase: "group",
    round: "1",
    scheduled_month: "2000-01",
    home_coach: "Coach A",
    away_coach: "Coach B",
    home_race: "Race X",
    away_race: "Race Y",
    ruleset_name: "Test Ruleset",
    ruleset_url: "https://example.invalid/ruleset",
    ...overrides,
  });
}

export function semifinal(overrides = {}) {
  return record({
    match_id: "TEST-SF1",
    phase: "semifinal",
    round: "SF",
    scheduled_month: "2000-09",
    home_slot: "group:1",
    away_slot: "group:4",
    ...overrides,
  });
}

export function final(overrides = {}) {
  return record({
    match_id: "TEST-F",
    phase: "final",
    round: "F",
    scheduled_month: "2000-10",
    home_slot: "winner:TEST-SF1",
    away_slot: "winner:TEST-SF2",
    ...overrides,
  });
}

export const completeResult = Object.freeze({
  home_td: "2",
  away_td: "1",
  home_cas: "3",
  away_cas: "0",
});
