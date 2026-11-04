import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { MATCH_COLUMNS, RESULT_STATUS } from "../js/domain/match-contract.js";
import {
  getResultStatus,
  validateHeaders,
  validateMatch,
  validateMatches,
} from "../js/domain/match-validation.js";
import { completeResult, final, groupMatch, semifinal } from "./fixtures/synthetic-matches.js";

function codes(issues) {
  return issues.map((entry) => entry.code);
}

function issuesFor(record) {
  return validateMatch(record, 1).issues;
}

describe("validateHeaders", () => {
  it("accepts the full contract header, in any order and with extra columns", () => {
    assert.deepEqual(validateHeaders([...MATCH_COLUMNS].reverse().concat("notes")), []);
  });

  it("reports each missing column", () => {
    const headers = MATCH_COLUMNS.filter((column) => column !== "home_td" && column !== "phase");
    const issues = validateHeaders(headers);
    assert.deepEqual(codes(issues), ["missing-column", "missing-column"]);
    assert.deepEqual(issues.map((entry) => entry.field).sort(), ["home_td", "phase"]);
  });
});

describe("valid records", () => {
  it("accepts a scheduled group match without result", () => {
    assert.deepEqual(issuesFor(groupMatch()), []);
  });

  it("accepts a group match with match date and complete result", () => {
    assert.deepEqual(issuesFor(groupMatch({ match_date: "2000-01-15", ...completeResult })), []);
  });

  it("accepts optional fields left empty", () => {
    const record = groupMatch({ home_race: "", away_race: "", ruleset_name: "", ruleset_url: "" });
    assert.deepEqual(issuesFor(record), []);
  });

  it("trims surrounding whitespace and parses scores to integers", () => {
    const { match, issues } = validateMatch(
      groupMatch({ match_id: " TEST-G01 ", home_td: " 2 ", away_td: "0", home_cas: "1", away_cas: "10" }),
      1,
    );
    assert.deepEqual(issues, []);
    assert.equal(match.match_id, "TEST-G01");
    assert.deepEqual(
      [match.home_td, match.away_td, match.home_cas, match.away_cas],
      [2, 0, 1, 10],
    );
  });
});

describe("required fields", () => {
  for (const field of ["match_id", "phase", "round", "scheduled_month", "home_coach", "away_coach"]) {
    it(`reports missing ${field} on a group match`, () => {
      const issues = issuesFor(groupMatch({ [field]: "" }));
      assert.ok(
        issues.some((entry) => entry.code === "missing-required" && entry.field === field),
        `expected missing-required for ${field}, got ${JSON.stringify(codes(issues))}`,
      );
    });
  }

  it("treats whitespace-only values as empty", () => {
    assert.deepEqual(codes(issuesFor(groupMatch({ round: "   " }))), ["missing-required"]);
  });

  it("treats absent columns as empty", () => {
    const record = groupMatch();
    delete record.round;
    assert.deepEqual(codes(issuesFor(record)), ["missing-required"]);
  });
});

describe("field formats", () => {
  it("rejects an unknown phase", () => {
    assert.deepEqual(codes(issuesFor(groupMatch({ phase: "Group" }))), ["invalid-phase"]);
  });

  for (const value of ["2000-13", "2000-1", "01-2000", "January 2000"]) {
    it(`rejects scheduled_month "${value}"`, () => {
      assert.deepEqual(codes(issuesFor(groupMatch({ scheduled_month: value }))), ["invalid-month"]);
    });
  }

  for (const value of ["2000-02-30", "15-01-2000", "2000-1-5", "15/01/2000"]) {
    it(`rejects match_date "${value}"`, () => {
      assert.deepEqual(codes(issuesFor(groupMatch({ match_date: value }))), ["invalid-date"]);
    });
  }

  it("rejects a non-http ruleset URL", () => {
    assert.deepEqual(codes(issuesFor(groupMatch({ ruleset_url: "not a url" }))), ["invalid-url"]);
    assert.deepEqual(codes(issuesFor(groupMatch({ ruleset_url: "ftp://example.invalid/x" }))), ["invalid-url"]);
  });
});

describe("coaches", () => {
  it("rejects a coach playing against themselves", () => {
    assert.deepEqual(codes(issuesFor(groupMatch({ away_coach: "Coach A" }))), ["same-coach"]);
  });

  it("compares coach names case-insensitively", () => {
    assert.deepEqual(codes(issuesFor(groupMatch({ away_coach: "coach a " }))), ["same-coach"]);
  });
});

describe("result status", () => {
  it("is none when all result fields are empty", () => {
    const { match, issues } = validateMatch(groupMatch(), 1);
    assert.deepEqual(issues, []);
    assert.equal(match.resultStatus, RESULT_STATUS.NONE);
    assert.deepEqual([match.home_td, match.away_td, match.home_cas, match.away_cas], [null, null, null, null]);
  });

  it("treats zero as an entered value", () => {
    const { match, issues } = validateMatch(
      groupMatch({ home_td: "0", away_td: "0", home_cas: "0", away_cas: "0" }),
      1,
    );
    assert.deepEqual(issues, []);
    assert.equal(match.resultStatus, RESULT_STATUS.COMPLETE);
    assert.deepEqual([match.home_td, match.away_td, match.home_cas, match.away_cas], [0, 0, 0, 0]);
  });

  it("is partial when one to three result fields are filled", () => {
    assert.equal(getResultStatus(groupMatch({ home_td: "0" })), RESULT_STATUS.PARTIAL);
    assert.equal(getResultStatus(groupMatch({ home_td: "1", away_td: "1" })), RESULT_STATUS.PARTIAL);
    assert.equal(
      getResultStatus(groupMatch({ home_td: "1", away_td: "1", home_cas: "0" })),
      RESULT_STATUS.PARTIAL,
    );
  });

  it("does not report a partial result as invalid", () => {
    const { match, issues } = validateMatch(groupMatch({ home_td: "1", away_td: "2" }), 1);
    assert.deepEqual(issues, []);
    assert.equal(match.resultStatus, RESULT_STATUS.PARTIAL);
  });

  it("is complete when all four result fields are filled", () => {
    const { match, issues } = validateMatch(groupMatch(completeResult), 1);
    assert.deepEqual(issues, []);
    assert.equal(match.resultStatus, RESULT_STATUS.COMPLETE);
  });
});

describe("invalid scores", () => {
  for (const value of ["-1", "1.5", "1,0", "+2", "two", "1e1", "2.0"]) {
    it(`rejects "${value}"`, () => {
      const { match, issues } = validateMatch(groupMatch({ ...completeResult, home_td: value }), 1);
      assert.deepEqual(codes(issues), ["invalid-score"]);
      assert.equal(issues[0].field, "home_td");
      assert.equal(match.home_td, null);
    });
  }
});

describe("playoff records", () => {
  it("accepts a semifinal with slots and no coaches yet", () => {
    assert.deepEqual(issuesFor(semifinal()), []);
  });

  it("accepts a semifinal with slots and coaches filled in", () => {
    const record = semifinal({ home_coach: "Coach A", away_coach: "Coach D", ...completeResult });
    assert.deepEqual(issuesFor(record), []);
  });

  it("accepts a playoff match with coaches and no slots", () => {
    assert.deepEqual(issuesFor(semifinal({ home_slot: "", away_slot: "", home_coach: "Coach A", away_coach: "Coach D" })), []);
  });

  it("requires a coach or slot on each playoff side", () => {
    const issues = issuesFor(semifinal({ away_slot: "" }));
    assert.deepEqual(codes(issues), ["missing-participant"]);
    assert.equal(issues[0].field, "away_coach");
  });

  for (const value of ["group:0", "group:x", "first", "winner:", "Group:1"]) {
    it(`rejects slot "${value}"`, () => {
      assert.deepEqual(codes(issuesFor(semifinal({ home_slot: value }))), ["invalid-slot"]);
    });
  }

  it("rejects slots on group matches", () => {
    assert.deepEqual(codes(issuesFor(groupMatch({ home_slot: "group:1" }))), ["slot-not-allowed"]);
  });

  it("rejects a result while a participant is unknown", () => {
    const issues = issuesFor(semifinal({ home_coach: "Coach A", ...completeResult }));
    assert.deepEqual(codes(issues), ["result-without-coaches"]);
  });

  it("rejects a partial result while participants are unknown", () => {
    assert.deepEqual(codes(issuesFor(final({ home_td: "1" }))), ["result-without-coaches"]);
  });
});

describe("validateMatches", () => {
  const playoffs = [
    semifinal(),
    semifinal({ match_id: "TEST-SF2", home_slot: "group:2", away_slot: "group:3" }),
    final(),
  ];

  it("accepts a consistent set of group and playoff records", () => {
    const records = [
      groupMatch(),
      groupMatch({ match_id: "TEST-G02", home_coach: "Coach C", away_coach: "Coach D", ...completeResult }),
      ...playoffs,
    ];
    const { matches, issues } = validateMatches(records);
    assert.deepEqual(issues, []);
    assert.equal(matches.length, records.length);
    assert.deepEqual(matches.map((match) => match.row), [1, 2, 3, 4, 5]);
  });

  it("accepts an empty data set", () => {
    assert.deepEqual(validateMatches([]), { matches: [], issues: [] });
  });

  it("reports duplicate match identifiers with the row of the first occurrence", () => {
    const { issues } = validateMatches([groupMatch(), groupMatch({ home_coach: "Coach C" })]);
    assert.deepEqual(codes(issues), ["duplicate-id"]);
    assert.equal(issues[0].row, 2);
    assert.match(issues[0].message, /row 1/);
  });

  it("reports winner slots that reference an unknown match", () => {
    const { issues } = validateMatches([semifinal(), final()]);
    assert.deepEqual(codes(issues), ["unknown-slot-match"]);
    assert.equal(issues[0].field, "away_slot");
  });

  it("reports a match referencing its own winner", () => {
    const { issues } = validateMatches([final({ home_slot: "winner:TEST-F", away_slot: "group:1" })]);
    assert.deepEqual(codes(issues), ["invalid-slot"]);
  });

  it("uses supplied row numbers in matches and issues", () => {
    const { matches, issues } = validateMatches([groupMatch(), groupMatch()], [2, 5]);
    assert.deepEqual(matches.map((match) => match.row), [2, 5]);
    assert.equal(issues[0].row, 5);
    assert.match(issues[0].message, /row 2/);
  });

  it("includes row number and match id in every issue", () => {
    const { issues } = validateMatches([groupMatch(), groupMatch({ match_id: "TEST-G02", home_td: "-1" })]);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].row, 2);
    assert.equal(issues[0].matchId, "TEST-G02");
  });
});
