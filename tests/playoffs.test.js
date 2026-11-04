import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateMatches } from "../js/domain/match-validation.js";
import {
  isGroupStageComplete,
  playoffMatchLabels,
  qualificationByCoach,
  qualifyingPlaces,
  resolvePlayoffs,
  winnerOf,
} from "../js/domain/playoffs.js";
import { issuesByRow } from "../js/domain/schedule.js";
import { computeStandings } from "../js/domain/standings.js";
import { final, groupMatch, semifinal } from "./fixtures/synthetic-matches.js";

let nextId = 0;
function played(home, away, [homeTd, awayTd, homeCas = 0, awayCas = 0]) {
  nextId += 1;
  return groupMatch({
    match_id: `TEST-G${nextId}`, home_coach: home, away_coach: away,
    home_td: String(homeTd), away_td: String(awayTd), home_cas: String(homeCas), away_cas: String(awayCas),
  });
}

function result([homeTd, awayTd, homeCas = 0, awayCas = 0]) {
  return { home_td: String(homeTd), away_td: String(awayTd), home_cas: String(homeCas), away_cas: String(awayCas) };
}

/** A finished group stage with a clear order: A > B > C > D > E. */
function clearGroupStage() {
  return [
    played("Coach A", "Coach E", [5, 0]),
    played("Coach B", "Coach E", [4, 0]),
    played("Coach C", "Coach E", [3, 0]),
    played("Coach D", "Coach E", [2, 0]),
  ];
}

const sf2 = (overrides = {}) => semifinal({ match_id: "TEST-SF2", home_slot: "group:2", away_slot: "group:3", ...overrides });

function resolve(records) {
  const { matches, issues } = validateMatches(records);
  return { ...resolvePlayoffs(matches, issues), matches, issues };
}

function participantsOf(resolved, matchId) {
  const match = resolved.matches.find((entry) => entry.match_id === matchId);
  return resolved.participants.get(match.row);
}

describe("winnerOf", () => {
  const rowIssues = new Map();
  const validate = (record) => validateMatches([record]).matches[0];

  it("is pending without a complete result", () => {
    assert.equal(winnerOf(validate(groupMatch({ home_td: "1" })), rowIssues).status, "pending");
  });

  it("is a draw on equal touchdowns, whatever the casualties", () => {
    assert.equal(winnerOf(validate(groupMatch(result([1, 1, 3, 0]))), rowIssues).status, "draw");
  });

  it("names the coach with more touchdowns", () => {
    assert.deepEqual(winnerOf(validate(groupMatch(result([0, 2]))), rowIssues), { status: "decided", coach: "Coach B" });
  });

  it("is pending when the match has validation issues", () => {
    const { matches, issues } = validateMatches([groupMatch({ ...result([2, 0]), match_date: "bad" })]);
    assert.equal(winnerOf(matches[0], issuesByRow(issues)).status, "pending");
  });
});

describe("isGroupStageComplete", () => {
  const check = (records) => {
    const { matches, issues } = validateMatches(records);
    return isGroupStageComplete(matches, issuesByRow(issues));
  };

  it("is true when every group match is complete and valid", () => {
    assert.equal(check([...clearGroupStage(), semifinal()]), true);
  });

  it("is false while a group match has no or a partial result", () => {
    assert.equal(check([...clearGroupStage(), groupMatch({ match_id: "TEST-X" })]), false);
    assert.equal(check([...clearGroupStage(), groupMatch({ match_id: "TEST-X", home_td: "1" })]), false);
  });

  it("is false when a group match is invalid", () => {
    assert.equal(check([...clearGroupStage(), groupMatch({ match_id: "TEST-X", ...result([1, 0]), match_date: "bad" })]), false);
  });

  it("is false without group matches", () => {
    assert.equal(check([semifinal()]), false);
  });
});

describe("qualifyingPlaces", () => {
  it("is the highest group slot in the playoff rows", () => {
    const { matches } = validateMatches([semifinal(), sf2(), final()]);
    assert.equal(qualifyingPlaces(matches), 4);
  });

  it("is 0 without playoff rows", () => {
    assert.equal(qualifyingPlaces(validateMatches(clearGroupStage()).matches), 0);
  });
});

describe("qualificationByCoach", () => {
  const rowsFor = (records) => {
    const { matches, issues } = validateMatches(records);
    return computeStandings(matches, issues).rows;
  };

  it("marks the places up to the limit as qualifying", () => {
    const status = qualificationByCoach(rowsFor(clearGroupStage()), 4);
    assert.deepEqual(
      ["Coach A", "Coach B", "Coach C", "Coach D", "Coach E"].map((coach) => status.get(coach)),
      ["in", "in", "in", "in", "out"],
    );
  });

  it("marks a shared position across the limit as boundary", () => {
    const rows = rowsFor([
      played("Coach A", "Coach F", [5, 0]),
      played("Coach B", "Coach F", [4, 0]),
      played("Coach C", "Coach F", [3, 0]),
      played("Coach D", "Coach G", [1, 0]),
      played("Coach E", "Coach H", [1, 0]),
    ]);
    // D and E share 4th place; only one 4th place qualifies.
    const status = qualificationByCoach(rows, 4);
    assert.deepEqual(
      ["Coach C", "Coach D", "Coach E", "Coach F"].map((coach) => status.get(coach)),
      ["in", "boundary", "boundary", "out"],
    );
  });

  it("keeps a shared position fully inside the limit as qualifying", () => {
    const rows = rowsFor([played("Coach A", "Coach C", [1, 0]), played("Coach B", "Coach D", [1, 0])]);
    const status = qualificationByCoach(rows, 2);
    assert.deepEqual(["Coach A", "Coach B", "Coach C"].map((coach) => status.get(coach)), ["in", "in", "out"]);
  });
});

describe("playoffMatchLabels", () => {
  it("numbers matches within a phase in sheet order, and leaves single matches unnumbered", () => {
    const labels = playoffMatchLabels(validateMatches([final(), semifinal(), sf2()]).matches);
    assert.deepEqual(labels.get("TEST-SF1"), { phase: "semifinal", number: 1 });
    assert.deepEqual(labels.get("TEST-SF2"), { phase: "semifinal", number: 2 });
    assert.deepEqual(labels.get("TEST-F"), { phase: "final", number: null });
  });
});

describe("resolvePlayoffs", () => {
  it("leaves group slots open while the group stage is incomplete", () => {
    const resolved = resolve([...clearGroupStage(), groupMatch({ match_id: "TEST-OPEN" }), semifinal(), sf2(), final()]);
    const sf1 = participantsOf(resolved, "TEST-SF1");
    assert.deepEqual([sf1.home.source, sf1.home.reason], ["unresolved", "group-incomplete"]);
    assert.equal(resolved.groupComplete, false);
  });

  it("fills group slots from the final standings", () => {
    const resolved = resolve([...clearGroupStage(), semifinal(), sf2(), final()]);
    const sf1 = participantsOf(resolved, "TEST-SF1");
    const second = participantsOf(resolved, "TEST-SF2");
    assert.deepEqual([sf1.home.coach, sf1.home.source], ["Coach A", "standings"]);
    assert.equal(sf1.away.coach, "Coach D");
    assert.deepEqual([second.home.coach, second.away.coach], ["Coach B", "Coach C"]);
  });

  it("leaves a group slot open when its position is shared", () => {
    const resolved = resolve([
      played("Coach A", "Coach F", [5, 0]),
      played("Coach B", "Coach F", [4, 0]),
      played("Coach C", "Coach F", [3, 0]),
      played("Coach D", "Coach G", [1, 0]),
      played("Coach E", "Coach H", [1, 0]),
      semifinal(),
    ]);
    const sf1 = participantsOf(resolved, "TEST-SF1");
    assert.equal(sf1.home.coach, "Coach A");
    assert.deepEqual([sf1.away.source, sf1.away.reason], ["unresolved", "shared-position"]);
  });

  it("leaves a group slot open when the position does not exist", () => {
    const resolved = resolve([played("Coach A", "Coach B", [1, 0]), semifinal()]);
    assert.equal(participantsOf(resolved, "TEST-SF1").away.reason, "no-such-position");
  });

  it("always uses a coach entered in the sheet, even if the standings say otherwise", () => {
    const resolved = resolve([...clearGroupStage(), semifinal({ home_coach: "Coach E" })]);
    assert.deepEqual(participantsOf(resolved, "TEST-SF1").home, { coach: "Coach E", source: "sheet", reason: null });
  });

  it("fills winner slots from complete semifinal results", () => {
    const resolved = resolve([
      semifinal({ home_coach: "Coach A", away_coach: "Coach D", ...result([1, 2]) }),
      sf2({ home_coach: "Coach B", away_coach: "Coach C", ...result([3, 0]) }),
      final(),
    ]);
    const finalParticipants = participantsOf(resolved, "TEST-F");
    assert.deepEqual([finalParticipants.home.coach, finalParticipants.home.source], ["Coach D", "winner"]);
    assert.equal(finalParticipants.away.coach, "Coach B");
  });

  it("leaves a winner slot open while the referenced match is unplayed or partial", () => {
    const resolved = resolve([
      semifinal({ home_coach: "Coach A", away_coach: "Coach D" }),
      sf2({ home_coach: "Coach B", away_coach: "Coach C", home_td: "1" }),
      final(),
    ]);
    const finalParticipants = participantsOf(resolved, "TEST-F");
    assert.equal(finalParticipants.home.reason, "pending");
    assert.equal(finalParticipants.away.reason, "pending");
  });

  it("does not pick a winner after a drawn playoff match", () => {
    const resolved = resolve([
      semifinal({ home_coach: "Coach A", away_coach: "Coach D", ...result([1, 1, 4, 0]) }),
      sf2(),
      final(),
    ]);
    assert.equal(participantsOf(resolved, "TEST-F").home.reason, "draw");
  });

  it("reports the number of qualifying places from the slots", () => {
    assert.equal(resolve([semifinal(), sf2(), final()]).qualifyingPlaces, 4);
  });

  it("ignores group matches", () => {
    const resolved = resolve(clearGroupStage());
    assert.equal(resolved.participants.size, 0);
  });
});
