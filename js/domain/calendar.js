// Calendar logic in the league's time zone, independent of the visitor's clock settings.

import { RESULT_STATUS } from "./match-contract.js";
import { isValidDate } from "./match-validation.js";

/** Dutch time: CET in winter, CEST in summer. */
export const LEAGUE_TIME_ZONE = "Europe/Amsterdam";

/** Today's date in the league time zone as `YYYY-MM-DD`. */
export function leagueToday(now = new Date()) {
  // The en-CA locale formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LEAGUE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * True when the match date has passed and no result has been entered yet.
 * A partial result is not "awaiting": entry has started.
 * @param {object} match validated match
 * @param {string} today `YYYY-MM-DD`, see leagueToday
 */
export function isAwaitingResult(match, today) {
  return (
    match.resultStatus === RESULT_STATUS.NONE &&
    isValidDate(match.match_date) &&
    match.match_date < today // ISO dates compare correctly as strings
  );
}
