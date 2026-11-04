// Loads the `Matches` worksheet from Google Sheets and validates it.
//
// Uses the plain CSV export rather than the gviz endpoint: gviz infers one type
// per column and blanks out cells that don't fit (e.g. `SF` in a mostly numeric
// `round` column), which would silently lose data.

import { validateHeaders, validateMatches } from "../domain/match-validation.js";
import { parseCsv } from "./csv.js";

const FETCH_TIMEOUT_MS = 15000;

export class SheetLoadError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "SheetLoadError";
  }
}

export function buildCsvExportUrl({ spreadsheetId, worksheetGid }) {
  const id = encodeURIComponent(spreadsheetId);
  const gid = encodeURIComponent(worksheetGid);
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

/**
 * Converts parsed CSV rows into records keyed by header.
 * Rows where every cell is empty are skipped (Sheets exports rows that were
 * cleared but not deleted); every other row is kept and validated.
 * @param {string[][]} rows
 * @returns {{ headers: string[], records: Record<string, string>[], rowNumbers: number[] }}
 *   rowNumbers holds the spreadsheet row of each record (header = row 1).
 */
export function rowsToRecords(rows) {
  if (rows.length === 0) return { headers: [], records: [], rowNumbers: [] };

  const headers = rows[0].map((header) => header.trim());
  const records = [];
  const rowNumbers = [];

  rows.slice(1).forEach((cells, index) => {
    if (cells.every((cell) => cell.trim() === "")) return;
    const record = {};
    headers.forEach((header, column) => {
      if (header !== "") record[header] = cells[column] ?? "";
    });
    records.push(record);
    rowNumbers.push(index + 2);
  });

  return { headers, records, rowNumbers };
}

/**
 * Parses and validates the CSV text of the `Matches` worksheet.
 * If contract columns are missing, rows are not validated (every row would fail),
 * and only the header issues are returned.
 */
export function readMatchesCsv(text) {
  const { headers, records, rowNumbers } = rowsToRecords(parseCsv(text));

  const headerIssues = validateHeaders(headers);
  if (headerIssues.length > 0) {
    return { matches: [], issues: headerIssues };
  }

  return validateMatches(records, rowNumbers);
}

/**
 * Fetches the `Matches` worksheet and returns validated matches plus all issues.
 * Throws SheetLoadError when the sheet cannot be read at all.
 * @param {{ spreadsheetId: string, worksheetGid: string }} sheet
 * @param {{ fetchImpl?: typeof fetch }} [options] fetchImpl is injectable for tests
 */
export async function loadMatches(sheet, { fetchImpl = globalThis.fetch } = {}) {
  const url = buildCsvExportUrl(sheet);

  let response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (error) {
    throw new SheetLoadError("The match data could not be reached.", { cause: error });
  }

  if (!response.ok) {
    throw new SheetLoadError(`The match data could not be loaded (HTTP ${response.status}).`);
  }

  // A sheet that is not shared publicly answers with an HTML sign-in page.
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/csv")) {
    throw new SheetLoadError("The match data is not available as CSV. Is the sheet shared publicly?");
  }

  try {
    return readMatchesCsv(await response.text());
  } catch (error) {
    throw new SheetLoadError("The match data could not be read.", { cause: error });
  }
}
