import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateMatches } from "../js/domain/match-validation.js";
import { computeStandings } from "../js/domain/standings.js";
import { final, groupMatch, semifinal } from "./fixtures/synthetic-matches.js";

let nextId = 1;
/** Synthetic group match with a result: [homeTd, awayTd, homeCas, awayCas]. */
function played(home, away, [homeTd, awayTd, homeCas, awayCas]) {
  nextId += 1;
  return groupMatch({
    match_id: `TEST-G${nextId}`,
    home_coach: home,
    away_coach: away,
    home_td: String(homeTd),
    away_td: String(awayTd),
    home_cas: String(homeCas),
    away_cas: String(awayCas),
  });
}

function unplayed(home, away) {
  nextId += 1;
  return groupMatch({ match_id: `TEST-G${nextId}`, home_coach: home, away_coach: away });
}

function standingsFor(records) {
  const { matches, issues } = validateMatches(records);
  return computeStandings(matches, issues);
}

function byCoach(standings) {
  return Object.fromEntries(standings.rows.map((row) => [row.coach, row]));
}

describe("computeStandings", () => {
  it("lists every group coach with zeros before any results", () => {
    const standings = standingsFor([unplayed("Coach A", "Coach B"), unplayed("Coach C", "Coach D")]);
    assert.equal(standings.countedMatches, 0);
    assert.deepEqual(standings.rows.map((row) => row.coach), ["Coach A", "Coach B", "Coach C", "Coach D"]);
    assert.ok(standings.rows.every((row) => row.points === 0 && row.played === 0 && row.position === 1));
    assert.equal(standings.hasSharedPositions, true);
  });

  it("awards 3 points for a win and 0 for a loss", () => {
    const rows = byCoach(standingsFor([played("Coach A", "Coach B", [2, 1, 0, 0])]));
    assert.deepEqual([rows["Coach A"].points, rows["Coach A"].won], [3, 1]);
    assert.deepEqual([rows["Coach B"].points, rows["Coach B"].lost], [0, 1]);
  });

  it("awards 1 point each for a draw, including 0-0", () => {
    const rows = byCoach(standingsFor([played("Coach A", "Coach B", [0, 0, 0, 0])]));
    assert.deepEqual([rows["Coach A"].points, rows["Coach A"].drawn], [1, 1]);
    assert.deepEqual([rows["Coach B"].points, rows["Coach B"].drawn], [1, 1]);
  });

  it("does not let casualties decide the match result", () => {
    const rows = byCoach(standingsFor([played("Coach A", "Coach B", [1, 1, 5, 0])]));
    assert.equal(rows["Coach A"].points, 1);
    assert.equal(rows["Coach B"].points, 1);
  });

  it("totals touchdowns and casualties for and against, from both sides", () => {
    const rows = byCoach(standingsFor([
      played("Coach A", "Coach B", [2, 1, 3, 1]),
      played("Coach C", "Coach A", [1, 1, 2, 0]),
    ]));
    const a = rows["Coach A"];
    assert.deepEqual(
      [a.played, a.tdFor, a.tdAgainst, a.casFor, a.casAgainst, a.netTd, a.netCas, a.tiebreaker, a.points],
      [2, 3, 2, 3, 3, 1, 0, 1, 4],
    );
  });

  it("ranks by points first", () => {
    const standings = standingsFor([
      played("Coach A", "Coach B", [0, 1, 9, 0]),
      played("Coach C", "Coach D", [1, 0, 0, 0]),
    ]);
    // A has the best tiebreaker (+8) but fewer points than B (-8) and C (+1).
    assert.deepEqual(standings.rows.slice(0, 2).map((row) => row.coach).sort(), ["Coach B", "Coach C"]);
    assert.equal(byCoach(standings)["Coach A"].tiebreaker, 8);
    assert.equal(byCoach(standings)["Coach A"].position, 3);
  });

  it("breaks equal points with net touchdowns plus net casualties", () => {
    const standings = standingsFor([
      played("Coach A", "Coach B", [1, 0, 0, 0]), // A: net TD +1, net CAS 0  -> +1
      played("Coach C", "Coach D", [1, 0, 0, 2]), // C: net TD +1, net CAS -2 -> -1
      played("Coach E", "Coach F", [1, 0, 3, 0]), // E: net TD +1, net CAS +3 -> +4
    ]);
    assert.deepEqual(standings.rows.slice(0, 3).map((row) => [row.coach, row.position]), [
      ["Coach E", 1],
      ["Coach A", 2],
      ["Coach C", 3],
    ]);
  });

  it("combines touchdowns and casualties into one tiebreaker value", () => {
    const standings = standingsFor([
      played("Coach A", "Coach B", [3, 0, 0, 1]), // A: +3 TD, -1 CAS -> +2
      played("Coach C", "Coach D", [1, 0, 1, 0]), // C: +1 TD, +1 CAS -> +2
    ]);
    const rows = byCoach(standings);
    assert.equal(rows["Coach A"].position, 1);
    assert.equal(rows["Coach C"].position, 1);
    assert.equal(rows["Coach A"].sharedPosition, true);
  });

  it("shares a position when points and tiebreaker are equal, skipping the next positions", () => {
    const standings = standingsFor([
      played("Coach A", "Coach B", [1, 0, 0, 0]),
      played("Coach C", "Coach D", [1, 0, 0, 0]),
    ]);
    assert.deepEqual(
      standings.rows.map((row) => [row.coach, row.position, row.sharedPosition]),
      [
        ["Coach A", 1, true],
        ["Coach C", 1, true],
        ["Coach B", 3, true],
        ["Coach D", 3, true],
      ],
    );
    assert.equal(standings.hasSharedPositions, true);
  });

  it("reports no shared positions when every coach is separated", () => {
    const standings = standingsFor([played("Coach A", "Coach B", [2, 0, 0, 0])]);
    assert.equal(standings.hasSharedPositions, false);
    assert.deepEqual(standings.rows.map((row) => row.position), [1, 2]);
  });

  it("ignores partial results", () => {
    const standings = standingsFor([groupMatch({ home_td: "2", away_td: "0" })]);
    assert.equal(standings.countedMatches, 0);
    assert.ok(standings.rows.every((row) => row.played === 0));
  });

  it("ignores matches with validation issues", () => {
    const standings = standingsFor([
      played("Coach A", "Coach B", [2, 0, 0, 0]),
      groupMatch({ match_id: "TEST-BAD", home_coach: "Coach C", away_coach: "Coach D",
        home_td: "1", away_td: "0", home_cas: "0", away_cas: "0", match_date: "not-a-date" }),
    ]);
    assert.equal(standings.countedMatches, 1);
    assert.equal(byCoach(standings)["Coach C"].played, 0);
  });

  it("ignores playoff matches and playoff-only participants", () => {
    const standings = standingsFor([
      played("Coach A", "Coach B", [1, 0, 0, 0]),
      semifinal({ home_coach: "Coach A", away_coach: "Coach Z", home_td: "0", away_td: "3", home_cas: "0", away_cas: "0" }),
      semifinal({ match_id: "TEST-SF2", home_slot: "group:2", away_slot: "group:3" }),
      final(),
    ]);
    assert.equal(standings.countedMatches, 1);
    assert.deepEqual(standings.rows.map((row) => row.coach), ["Coach A", "Coach B"]);
    assert.equal(byCoach(standings)["Coach A"].played, 1);
  });

  it("does not depend on the number of coaches", () => {
    const coaches = Array.from({ length: 11 }, (_, index) => `Coach ${index + 1}`);
    const records = coaches.slice(1).map((coach) => played(coaches[0], coach, [1, 0, 0, 0]));
    const standings = standingsFor(records);
    assert.equal(standings.rows.length, 11);
    assert.equal(standings.rows[0].coach, "Coach 1");
    assert.equal(standings.rows[0].points, 30);
  });

  it("returns an empty table for no matches", () => {
    assert.deepEqual(computeStandings([], []), { rows: [], countedMatches: 0, hasSharedPositions: false });
  });
});
