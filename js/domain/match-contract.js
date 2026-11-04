// Code representation of the `Matches` worksheet contract.
// The authoritative description is docs/data-contract.md; keep both in sync.

/** Column headers of the `Matches` worksheet, in sheet order. */
export const MATCH_COLUMNS = Object.freeze([
  "match_id",
  "phase",
  "round",
  "scheduled_month",
  "match_date",
  "home_slot",
  "home_coach",
  "home_race",
  "away_slot",
  "away_coach",
  "away_race",
  "home_td",
  "away_td",
  "home_cas",
  "away_cas",
  "ruleset_name",
  "ruleset_url",
]);

export const PHASES = Object.freeze({
  GROUP: "group",
  SEMIFINAL: "semifinal",
  FINAL: "final",
});

export const PLAYOFF_PHASES = Object.freeze([PHASES.SEMIFINAL, PHASES.FINAL]);

/** Fields that must be filled on every row. */
export const ALWAYS_REQUIRED_FIELDS = Object.freeze([
  "match_id",
  "phase",
  "round",
  "scheduled_month",
]);

/** The four result values; a match is complete only when all are present. */
export const RESULT_FIELDS = Object.freeze([
  "home_td",
  "away_td",
  "home_cas",
  "away_cas",
]);

export const RESULT_STATUS = Object.freeze({
  NONE: "none",
  PARTIAL: "partial",
  COMPLETE: "complete",
});

/**
 * Qualification slot for playoff participants that are not yet known.
 *   group:<N>          -> Nth place in the group standings
 *   winner:<match_id>  -> winner of the referenced match
 */
export const SLOT_PATTERN = /^(?:group:([1-9]\d*)|winner:(\S+))$/;
