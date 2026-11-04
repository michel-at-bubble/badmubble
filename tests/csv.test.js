import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { CsvParseError, parseCsv } from "../js/data/csv.js";

describe("parseCsv", () => {
  it("parses simple rows", () => {
    assert.deepEqual(parseCsv("a,b,c\n1,2,3"), [["a", "b", "c"], ["1", "2", "3"]]);
  });

  it("ignores a single trailing line break", () => {
    assert.deepEqual(parseCsv("a,b\n1,2\n"), [["a", "b"], ["1", "2"]]);
  });

  it("handles CRLF line endings", () => {
    assert.deepEqual(parseCsv("a,b\r\n1,2\r\n"), [["a", "b"], ["1", "2"]]);
  });

  it("strips a leading byte-order mark", () => {
    assert.deepEqual(parseCsv("﻿a,b"), [["a", "b"]]);
  });

  it("keeps empty fields, including leading and trailing ones", () => {
    assert.deepEqual(parseCsv(",x,,\n"), [["", "x", "", ""]]);
  });

  it("keeps rows consisting only of empty fields", () => {
    assert.deepEqual(parseCsv("a,b\n,\n1,2"), [["a", "b"], ["", ""], ["1", "2"]]);
  });

  it("parses quoted fields with separators, escaped quotes and line breaks", () => {
    const text = 'name,note\n"Coach, A","said ""hi""\nthen left"\n';
    assert.deepEqual(parseCsv(text), [
      ["name", "note"],
      ["Coach, A", 'said "hi"\nthen left'],
    ]);
  });

  it("treats an empty quoted field as empty", () => {
    assert.deepEqual(parseCsv('"",x'), [["", "x"]]);
  });

  it("preserves whitespace inside fields", () => {
    assert.deepEqual(parseCsv(" a , b "), [[" a ", " b "]]);
  });

  it("returns no rows for empty input", () => {
    assert.deepEqual(parseCsv(""), []);
  });

  it("rejects an unterminated quoted field", () => {
    assert.throws(() => parseCsv('a,"b\n1,2'), CsvParseError);
  });

  it("rejects a quote in the middle of an unquoted field", () => {
    assert.throws(() => parseCsv('a,b"c'), CsvParseError);
  });

  it("rejects text after a closing quote", () => {
    assert.throws(() => parseCsv('"a"b,c'), CsvParseError);
  });
});
