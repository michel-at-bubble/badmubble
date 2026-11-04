import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { isAwaitingResult, leagueToday } from "../js/domain/calendar.js";
import { validateMatches } from "../js/domain/match-validation.js";
import { completeResult, groupMatch } from "./fixtures/synthetic-matches.js";

describe("leagueToday", () => {
  it("uses Dutch winter time (CET, UTC+1)", () => {
    assert.equal(leagueToday(new Date("2000-01-15T22:59:00Z")), "2000-01-15");
    assert.equal(leagueToday(new Date("2000-01-15T23:00:00Z")), "2000-01-16");
  });

  it("uses Dutch summer time (CEST, UTC+2)", () => {
    assert.equal(leagueToday(new Date("2000-07-15T21:59:00Z")), "2000-07-15");
    assert.equal(leagueToday(new Date("2000-07-15T22:00:00Z")), "2000-07-16");
  });
});

describe("isAwaitingResult", () => {
  const TODAY = "2000-01-15";
  const match = (overrides) => validateMatches([groupMatch(overrides)]).matches[0];

  it("is true for a past date without a result", () => {
    assert.equal(isAwaitingResult(match({ match_date: "2000-01-14" }), TODAY), true);
  });

  it("is false on the match day itself and for future dates", () => {
    assert.equal(isAwaitingResult(match({ match_date: "2000-01-15" }), TODAY), false);
    assert.equal(isAwaitingResult(match({ match_date: "2000-01-16" }), TODAY), false);
  });

  it("is false without a date", () => {
    assert.equal(isAwaitingResult(match({}), TODAY), false);
  });

  it("is false once a result is partly or fully entered", () => {
    assert.equal(isAwaitingResult(match({ match_date: "2000-01-14", home_td: "1" }), TODAY), false);
    assert.equal(isAwaitingResult(match({ match_date: "2000-01-14", ...completeResult }), TODAY), false);
  });

  it("is false for an invalid date", () => {
    assert.equal(isAwaitingResult(match({ match_date: "14/01/2000" }), TODAY), false);
  });
});
