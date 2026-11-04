import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { MATCH_COLUMNS } from "../js/domain/match-contract.js";
import {
  SheetLoadError,
  buildCsvExportUrl,
  loadMatches,
  readMatchesCsv,
  rowsToRecords,
} from "../js/data/matches-source.js";

// Synthetic sheet; not a real spreadsheet.
const TEST_SHEET = { spreadsheetId: "test-sheet-id", worksheetGid: "123" };
const HEADER = MATCH_COLUMNS.join(",");

/** Builds a CSV line in contract column order from the given values. */
function csvLine(values) {
  return MATCH_COLUMNS.map((column) => values[column] ?? "").join(",");
}

const groupLine = csvLine({
  match_id: "TEST-G01", phase: "group", round: "1", scheduled_month: "2000-01",
  home_coach: "Coach A", away_coach: "Coach B",
});

function fakeFetch({ status = 200, contentType = "text/csv; charset=utf-8", body = "", error } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (error) throw error;
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers({ "content-type": contentType }),
      text: async () => body,
    };
  };
  return { fetchImpl, calls };
}

describe("buildCsvExportUrl", () => {
  it("uses the plain CSV export for the given worksheet", () => {
    assert.equal(
      buildCsvExportUrl(TEST_SHEET),
      "https://docs.google.com/spreadsheets/d/test-sheet-id/export?format=csv&gid=123",
    );
  });
});

describe("rowsToRecords", () => {
  it("keys cells by trimmed header and reports spreadsheet row numbers", () => {
    const result = rowsToRecords([[" a ", "b"], ["1", "2"], ["3", "4"]]);
    assert.deepEqual(result.headers, ["a", "b"]);
    assert.deepEqual(result.records, [{ a: "1", b: "2" }, { a: "3", b: "4" }]);
    assert.deepEqual(result.rowNumbers, [2, 3]);
  });

  it("skips fully empty rows but keeps row numbers aligned with the sheet", () => {
    const result = rowsToRecords([["a", "b"], ["", " "], ["1", "2"]]);
    assert.deepEqual(result.records, [{ a: "1", b: "2" }]);
    assert.deepEqual(result.rowNumbers, [3]);
  });

  it("fills missing trailing cells with empty strings", () => {
    assert.deepEqual(rowsToRecords([["a", "b"], ["1"]]).records, [{ a: "1", b: "" }]);
  });

  it("ignores columns without a header", () => {
    assert.deepEqual(rowsToRecords([["a", ""], ["1", "x"]]).records, [{ a: "1" }]);
  });

  it("handles empty input", () => {
    assert.deepEqual(rowsToRecords([]), { headers: [], records: [], rowNumbers: [] });
  });
});

describe("readMatchesCsv", () => {
  it("accepts a header-only sheet", () => {
    assert.deepEqual(readMatchesCsv(`${HEADER}\n`), { matches: [], issues: [] });
  });

  it("returns validated matches", () => {
    const { matches, issues } = readMatchesCsv(`${HEADER}\n${groupLine}\n`);
    assert.deepEqual(issues, []);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].match_id, "TEST-G01");
    assert.equal(matches[0].row, 2);
  });

  it("reports issues with spreadsheet row numbers", () => {
    const badLine = groupLine.replace("Coach B", "Coach A");
    const { issues } = readMatchesCsv(`${HEADER}\n\n${badLine}\n`);
    assert.deepEqual(issues.map((entry) => [entry.code, entry.row]), [["same-coach", 3]]);
  });

  it("returns only header issues when contract columns are missing", () => {
    const text = `match_id,phase\nTEST-G01,group\n`;
    const { matches, issues } = readMatchesCsv(text);
    assert.deepEqual(matches, []);
    assert.equal(issues.length, MATCH_COLUMNS.length - 2);
    assert.ok(issues.every((entry) => entry.code === "missing-column"));
  });

  it("reports an empty export as missing columns", () => {
    const { issues } = readMatchesCsv("");
    assert.equal(issues.length, MATCH_COLUMNS.length);
  });
});

describe("loadMatches", () => {
  it("fetches the export URL and returns validated matches", async () => {
    const { fetchImpl, calls } = fakeFetch({ body: `${HEADER}\n${groupLine}\n` });
    const { matches, issues } = await loadMatches(TEST_SHEET, { fetchImpl });
    assert.deepEqual(calls, [buildCsvExportUrl(TEST_SHEET)]);
    assert.deepEqual(issues, []);
    assert.equal(matches.length, 1);
  });

  it("throws SheetLoadError on network failure", async () => {
    const { fetchImpl } = fakeFetch({ error: new TypeError("Failed to fetch") });
    await assert.rejects(loadMatches(TEST_SHEET, { fetchImpl }), SheetLoadError);
  });

  it("throws SheetLoadError on an HTTP error", async () => {
    const { fetchImpl } = fakeFetch({ status: 404 });
    await assert.rejects(loadMatches(TEST_SHEET, { fetchImpl }), /HTTP 404/);
  });

  it("throws SheetLoadError when the response is not CSV", async () => {
    const { fetchImpl } = fakeFetch({ contentType: "text/html", body: "<html></html>" });
    await assert.rejects(loadMatches(TEST_SHEET, { fetchImpl }), /shared publicly/);
  });

  it("throws SheetLoadError on malformed CSV", async () => {
    const { fetchImpl } = fakeFetch({ body: `${HEADER}\n"unterminated\n` });
    await assert.rejects(loadMatches(TEST_SHEET, { fetchImpl }), SheetLoadError);
  });
});
