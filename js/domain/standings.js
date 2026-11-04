// Group-stage standings.
//
// Ranking: points, then net touchdowns + net casualties. No further tiebreakers
// have been established, so coaches still level after that share a position.
// Within a shared position, coaches are listed alphabetically for display only.

import { PHASES, RESULT_STATUS } from "./match-contract.js";
import { POINTS } from "./competition-rules.js";
import { issuesByRow } from "./schedule.js";

function emptyRow(coach) {
  return {
    coach,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    tdFor: 0,
    tdAgainst: 0,
    casFor: 0,
    casAgainst: 0,
    points: 0,
  };
}

function record(row, { tdFor, tdAgainst, casFor, casAgainst }, points) {
  row.played += 1;
  row.tdFor += tdFor;
  row.tdAgainst += tdAgainst;
  row.casFor += casFor;
  row.casAgainst += casAgainst;
  if (tdFor > tdAgainst) {
    row.won += 1;
    row.points += points.win;
  } else if (tdFor === tdAgainst) {
    row.drawn += 1;
    row.points += points.draw;
  } else {
    row.lost += 1;
    row.points += points.loss;
  }
}

/** Whether a match counts towards the standings. */
export function countsForStandings(match, rowIssues) {
  return (
    match.phase === PHASES.GROUP &&
    match.resultStatus === RESULT_STATUS.COMPLETE &&
    (rowIssues.get(match.row) ?? []).length === 0
  );
}

/**
 * Computes the group standings.
 * Every coach named in a group match is listed, including coaches without counted matches.
 * Only complete group matches without validation issues count.
 * @param {object[]} matches validated matches
 * @param {object[]} issues validation issues
 * @returns {{ rows: object[], countedMatches: number, hasSharedPositions: boolean }}
 */
export function computeStandings(matches, issues, points = POINTS) {
  const rowIssues = issuesByRow(issues);
  const byCoach = new Map();
  const rowFor = (coach) => {
    if (!byCoach.has(coach)) byCoach.set(coach, emptyRow(coach));
    return byCoach.get(coach);
  };

  let countedMatches = 0;
  for (const match of matches) {
    if (match.phase !== PHASES.GROUP) continue;
    if (match.home_coach !== "") rowFor(match.home_coach);
    if (match.away_coach !== "") rowFor(match.away_coach);
    if (!countsForStandings(match, rowIssues)) continue;

    countedMatches += 1;
    record(rowFor(match.home_coach), {
      tdFor: match.home_td, tdAgainst: match.away_td, casFor: match.home_cas, casAgainst: match.away_cas,
    }, points);
    record(rowFor(match.away_coach), {
      tdFor: match.away_td, tdAgainst: match.home_td, casFor: match.away_cas, casAgainst: match.home_cas,
    }, points);
  }

  const rows = [...byCoach.values()].map((row) => {
    const netTd = row.tdFor - row.tdAgainst;
    const netCas = row.casFor - row.casAgainst;
    return { ...row, netTd, netCas, tiebreaker: netTd + netCas };
  });

  const compareRanking = (a, b) => b.points - a.points || b.tiebreaker - a.tiebreaker;
  rows.sort((a, b) => compareRanking(a, b) || a.coach.localeCompare(b.coach));

  let hasSharedPositions = false;
  rows.forEach((row, index) => {
    const previous = rows[index - 1];
    const shared = previous !== undefined && compareRanking(previous, row) === 0;
    row.position = shared ? previous.position : index + 1;
    if (shared) {
      previous.sharedPosition = true;
      row.sharedPosition = true;
      hasSharedPositions = true;
    } else {
      row.sharedPosition = false;
    }
  });

  return { rows, countedMatches, hasSharedPositions };
}
