// Playoff participants and qualification.
//
// The sheet is leading: a coach entered in a playoff row is always used as is.
// Only when that cell is empty is the participant derived from its slot:
//   group:N          -> the coach in position N of the final group standings,
//                       once every group match is complete and valid, and only
//                       if that position is not shared (no further tiebreakers
//                       have been established);
//   winner:<id>      -> the winner of that match, once its result is complete
//                       and valid and not a draw (no rule for playoff draws).
// The number of qualifying places is not configured: it follows from the
// highest group:N slot in the sheet.

import { PHASES, PLAYOFF_PHASES, RESULT_STATUS, SLOT_PATTERN } from "./match-contract.js";
import { issuesByRow } from "./schedule.js";
import { computeStandings } from "./standings.js";

const SIDES = ["home", "away"];

function isValidComplete(match, rowIssues) {
  return match.resultStatus === RESULT_STATUS.COMPLETE && (rowIssues.get(match.row) ?? []).length === 0;
}

/**
 * Winner of a match: { status: "pending" | "draw" | "decided", coach }.
 */
export function winnerOf(match, rowIssues) {
  if (!isValidComplete(match, rowIssues)) return { status: "pending", coach: "" };
  if (match.home_td === match.away_td) return { status: "draw", coach: "" };
  return { status: "decided", coach: match.home_td > match.away_td ? match.home_coach : match.away_coach };
}

/** True when the group stage has matches and every one of them is complete and valid. */
export function isGroupStageComplete(matches, rowIssues) {
  const groupMatches = matches.filter((match) => match.phase === PHASES.GROUP);
  return groupMatches.length > 0 && groupMatches.every((match) => isValidComplete(match, rowIssues));
}

/** Highest N used in a group:N slot; 0 when there are none. */
export function qualifyingPlaces(matches) {
  let places = 0;
  for (const match of matches) {
    if (!PLAYOFF_PHASES.includes(match.phase)) continue;
    for (const side of SIDES) {
      const position = SLOT_PATTERN.exec(match[`${side}_slot`])?.[1];
      if (position !== undefined) places = Math.max(places, Number(position));
    }
  }
  return places;
}

/**
 * Standings rows that cover position N: one row if N is a clear position,
 * several if N falls inside a shared position, none if N exceeds the table.
 */
function rowsCoveringPosition(rows, position) {
  return rows.filter((row) => {
    const shared = rows.filter((other) => other.position === row.position).length;
    return row.position <= position && position <= row.position + shared - 1;
  });
}

/**
 * Qualification status per standings row, given the number of qualifying places:
 *   "in"       -> qualifies,
 *   "boundary" -> shares a position that straddles the last qualifying place,
 *   "out"      -> does not qualify.
 * @returns {Map<string, "in"|"boundary"|"out">} keyed by coach
 */
export function qualificationByCoach(rows, places) {
  const status = new Map();
  for (const row of rows) {
    const shared = rows.filter((other) => other.position === row.position).length;
    const lastPosition = row.position + shared - 1;
    if (lastPosition <= places) status.set(row.coach, "in");
    else if (row.position <= places) status.set(row.coach, "boundary");
    else status.set(row.coach, "out");
  }
  return status;
}

/**
 * Labels for playoff matches: { phase, number }, where number is the match's
 * position within its phase (sheet order), or null if the phase has one match.
 * @returns {Map<string, { phase: string, number: number|null }>} keyed by match_id
 */
export function playoffMatchLabels(matches) {
  const labels = new Map();
  for (const phase of PLAYOFF_PHASES) {
    const inPhase = matches.filter((match) => match.phase === phase && match.match_id !== "");
    inPhase.forEach((match, index) => {
      labels.set(match.match_id, { phase, number: inPhase.length > 1 ? index + 1 : null });
    });
  }
  return labels;
}

function resolveSide(match, side, context) {
  const coach = match[`${side}_coach`];
  if (coach !== "") return { coach, source: "sheet", reason: null };

  const slot = SLOT_PATTERN.exec(match[`${side}_slot`]);
  if (!slot) return { coach: "", source: "unresolved", reason: "no-slot" };

  const [, position, matchId] = slot;
  if (position !== undefined) {
    if (!context.groupComplete) return { coach: "", source: "unresolved", reason: "group-incomplete" };
    const rows = rowsCoveringPosition(context.standings.rows, Number(position));
    if (rows.length === 0) return { coach: "", source: "unresolved", reason: "no-such-position" };
    if (rows.length > 1) return { coach: "", source: "unresolved", reason: "shared-position" };
    return { coach: rows[0].coach, source: "standings", reason: null };
  }

  const referenced = context.matchesById.get(matchId);
  if (!referenced) return { coach: "", source: "unresolved", reason: "unknown-match" };
  const winner = winnerOf(referenced, context.rowIssues);
  if (winner.status === "decided") return { coach: winner.coach, source: "winner", reason: null };
  return { coach: "", source: "unresolved", reason: winner.status === "draw" ? "draw" : "pending" };
}

/**
 * Resolves the participants of every playoff match.
 * @returns {{
 *   participants: Map<number, { home: object, away: object }>,  // keyed by row
 *   labels: Map<string, { phase: string, number: number|null }>,
 *   qualifyingPlaces: number,
 *   groupComplete: boolean,
 * }}
 */
export function resolvePlayoffs(matches, issues) {
  const rowIssues = issuesByRow(issues);
  const context = {
    rowIssues,
    standings: computeStandings(matches, issues),
    groupComplete: isGroupStageComplete(matches, rowIssues),
    matchesById: new Map(matches.filter((match) => match.match_id !== "").map((match) => [match.match_id, match])),
  };

  const participants = new Map();
  for (const match of matches) {
    if (!PLAYOFF_PHASES.includes(match.phase)) continue;
    participants.set(match.row, {
      home: resolveSide(match, "home", context),
      away: resolveSide(match, "away", context),
    });
  }

  return {
    participants,
    labels: playoffMatchLabels(matches),
    qualifyingPlaces: qualifyingPlaces(matches),
    groupComplete: context.groupComplete,
  };
}
