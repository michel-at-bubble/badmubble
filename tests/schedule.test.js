import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildScheduleSections, issuesByRow } from "../js/domain/schedule.js";
import { validateMatches } from "../js/domain/match-validation.js";
import { final, groupMatch, semifinal } from "./fixtures/synthetic-matches.js";

function sectionsFor(records) {
  return buildScheduleSections(validateMatches(records).matches);
}

describe("buildScheduleSections", () => {
  it("groups matches by phase and round, keeping sheet order", () => {
    const sections = sectionsFor([
      groupMatch({ match_id: "TEST-G01", round: "1" }),
      groupMatch({ match_id: "TEST-G02", round: "2", scheduled_month: "2000-02" }),
      groupMatch({ match_id: "TEST-G03", round: "1", home_coach: "Coach C", away_coach: "Coach D" }),
    ]);
    assert.deepEqual(
      sections.map((section) => [section.phase, section.round, section.matches.map((match) => match.match_id)]),
      [
        ["group", "1", ["TEST-G01", "TEST-G03"]],
        ["group", "2", ["TEST-G02"]],
      ],
    );
  });

  it("does not sort rounds numerically or alphabetically", () => {
    const sections = sectionsFor([
      groupMatch({ match_id: "TEST-G10", round: "10" }),
      groupMatch({ match_id: "TEST-G02", round: "2" }),
    ]);
    assert.deepEqual(sections.map((section) => section.round), ["10", "2"]);
  });

  it("places phases in competition order regardless of sheet order", () => {
    const sections = sectionsFor([
      final(),
      semifinal(),
      groupMatch(),
      semifinal({ match_id: "TEST-SF2", home_slot: "group:2", away_slot: "group:3" }),
    ]);
    assert.deepEqual(sections.map((section) => section.phase), ["group", "semifinal", "final"]);
    assert.equal(sections[1].matches.length, 2);
  });

  it("collects the distinct scheduled months of a section", () => {
    const sections = sectionsFor([
      groupMatch({ match_id: "TEST-G01" }),
      groupMatch({ match_id: "TEST-G02", scheduled_month: "2000-02" }),
      groupMatch({ match_id: "TEST-G03" }),
    ]);
    assert.deepEqual(sections[0].scheduledMonths, ["2000-01", "2000-02"]);
  });

  it("leaves out matches with an unknown phase", () => {
    assert.deepEqual(sectionsFor([groupMatch({ phase: "friendly" })]), []);
  });

  it("returns no sections for no matches", () => {
    assert.deepEqual(buildScheduleSections([]), []);
  });
});

describe("issuesByRow", () => {
  it("groups row issues and skips header issues", () => {
    const issues = [
      { row: 2, code: "a" },
      { row: null, code: "missing-column" },
      { row: 2, code: "b" },
      { row: 4, code: "c" },
    ];
    const byRow = issuesByRow(issues);
    assert.deepEqual([...byRow.keys()], [2, 4]);
    assert.deepEqual(byRow.get(2).map((entry) => entry.code), ["a", "b"]);
  });
});
