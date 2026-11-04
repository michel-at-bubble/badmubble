// Arranges validated matches into schedule sections for display.
// The order comes from the sheet: phases in competition order, rounds and
// matches in the order the administrator entered them.

import { PHASES } from "./match-contract.js";

const PHASE_ORDER = [PHASES.GROUP, PHASES.SEMIFINAL, PHASES.FINAL];

/**
 * @typedef {object} ScheduleSection
 * @property {string} phase
 * @property {string} round
 * @property {string[]} scheduledMonths distinct months in sheet order
 * @property {object[]} matches
 */

/**
 * Groups matches into one section per phase and round.
 * Matches with an unknown phase are left out; they are reported as validation issues.
 * @param {object[]} matches validated matches (see validateMatches)
 * @returns {ScheduleSection[]}
 */
export function buildScheduleSections(matches) {
  const sectionsByKey = new Map();

  for (const match of matches) {
    if (!PHASE_ORDER.includes(match.phase)) continue;
    const key = `${match.phase}\u0000${match.round}`;
    if (!sectionsByKey.has(key)) {
      sectionsByKey.set(key, { phase: match.phase, round: match.round, scheduledMonths: [], matches: [] });
    }
    const section = sectionsByKey.get(key);
    section.matches.push(match);
    if (match.scheduled_month !== "" && !section.scheduledMonths.includes(match.scheduled_month)) {
      section.scheduledMonths.push(match.scheduled_month);
    }
  }

  const sections = [...sectionsByKey.values()];
  // Array.prototype.sort is stable, so sheet order is kept within each phase.
  return sections.sort((a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase));
}

/**
 * Groups issues by the row they belong to, so the view can mark invalid matches.
 * Header issues (row null) are not included.
 * @returns {Map<number, object[]>}
 */
export function issuesByRow(issues) {
  const byRow = new Map();
  for (const entry of issues) {
    if (entry.row === null) continue;
    if (!byRow.has(entry.row)) byRow.set(entry.row, []);
    byRow.get(entry.row).push(entry);
  }
  return byRow;
}
