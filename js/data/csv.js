// Minimal RFC 4180 CSV parser for Google Sheets exports.
//
// Handles quoted fields, escaped quotes (""), separators and line breaks
// inside quotes, CRLF/LF line endings, a leading byte-order mark and a
// trailing line break. Malformed input throws rather than being guessed at.

export class CsvParseError extends Error {
  constructor(message) {
    super(message);
    this.name = "CsvParseError";
  }
}

/**
 * Parses CSV text into rows of string fields.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  const input = text.startsWith("﻿") ? text.slice(1) : text;
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let fieldWasQuoted = false;
  let line = 1;

  const endField = () => {
    row.push(field);
    field = "";
    fieldWasQuoted = false;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inQuotes) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (char === "\n") line += 1;
        field += char;
      }
      continue;
    }

    if (char === '"') {
      if (field !== "" || fieldWasQuoted) {
        throw new CsvParseError(`Unexpected quote on line ${line}.`);
      }
      inQuotes = true;
      fieldWasQuoted = true;
    } else if (char === ",") {
      endField();
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      endRow();
      line += 1;
    } else if (fieldWasQuoted) {
      throw new CsvParseError(`Unexpected character after closing quote on line ${line}.`);
    } else {
      field += char;
    }
  }

  if (inQuotes) {
    throw new CsvParseError("Unterminated quoted field at end of input.");
  }

  // A trailing line break ends the last row; it does not start a new one.
  if (field !== "" || fieldWasQuoted || row.length > 0) {
    endRow();
  }

  return rows;
}
