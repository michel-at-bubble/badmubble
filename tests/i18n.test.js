import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  LANGUAGES,
  TRANSLATIONS,
  createTranslator,
  describeSlot,
  formatDate,
  formatMonth,
  resolveLanguage,
  sectionTitle,
} from "../js/ui/i18n.js";

describe("translations", () => {
  it("define the same keys for every language", () => {
    const [first, ...others] = LANGUAGES.map((language) => Object.keys(TRANSLATIONS[language]).sort());
    for (const keys of others) assert.deepEqual(keys, first);
  });

  it("fill placeholders", () => {
    assert.equal(createTranslator("en")("round", { round: "3" }), "Round 3");
    assert.equal(createTranslator("nl")("round", { round: "3" }), "Ronde 3");
  });

  it("throw on an unknown key instead of showing nothing", () => {
    assert.throws(() => createTranslator("en")("doesNotExist"), /Missing translation/);
  });
});

describe("resolveLanguage", () => {
  it("prefers an explicit ?lang= parameter", () => {
    assert.equal(resolveLanguage({ search: "?lang=en", preferredLanguages: ["nl-NL"] }), "en");
  });

  it("ignores an unsupported ?lang= value", () => {
    assert.equal(resolveLanguage({ search: "?lang=de", preferredLanguages: ["en-US"] }), "en");
  });

  it("uses the first supported browser language", () => {
    assert.equal(resolveLanguage({ preferredLanguages: ["de-DE", "en-GB", "nl"] }), "en");
    assert.equal(resolveLanguage({ preferredLanguages: ["nl-BE"] }), "nl");
  });

  it("falls back to Dutch", () => {
    assert.equal(resolveLanguage({ preferredLanguages: ["fr-FR"] }), "nl");
    assert.equal(resolveLanguage(), "nl");
  });
});

describe("formatting", () => {
  it("formats months per language", () => {
    assert.equal(formatMonth("2000-11", "nl"), "november 2000");
    assert.equal(formatMonth("2000-11", "en"), "November 2000");
  });

  it("formats dates per language", () => {
    assert.equal(formatDate("2000-01-05", "nl"), "5 januari 2000");
    assert.equal(formatDate("2000-01-05", "en"), "5 January 2000");
  });

  it("returns invalid months and dates unchanged instead of failing or guessing", () => {
    for (const value of ["January 2000", "2000-13", "01-2000"]) assert.equal(formatMonth(value, "nl"), value);
    for (const value of ["15/01/2000", "2000-02-30", "2000-1-5"]) assert.equal(formatDate(value, "nl"), value);
  });

  it("describes qualification slots", () => {
    const translate = createTranslator("en");
    assert.equal(describeSlot("group:1", translate), "Group stage #1");
    assert.equal(describeSlot("winner:TEST-SF1", translate), "Winner TEST-SF1");
  });

  it("names winner slots after the referenced playoff match", () => {
    const labels = new Map([
      ["TEST-SF1", { phase: "semifinal", number: 1 }],
      ["TEST-F", { phase: "final", number: null }],
    ]);
    assert.equal(describeSlot("winner:TEST-SF1", createTranslator("nl"), labels), "Winnaar halve finale 1");
    assert.equal(describeSlot("winner:TEST-SF1", createTranslator("en"), labels), "Winner semifinal 1");
    assert.equal(describeSlot("winner:TEST-F", createTranslator("en"), labels), "Winner final");
  });

  it("keeps match ids containing a colon intact", () => {
    assert.equal(describeSlot("winner:A:1", createTranslator("en")), "Winner A:1");
  });

  it("titles sections by phase", () => {
    const translate = createTranslator("nl");
    assert.equal(sectionTitle({ phase: "group", round: "2" }, translate), "Ronde 2");
    assert.equal(sectionTitle({ phase: "semifinal", round: "SF" }, translate), "Halve finales");
    assert.equal(sectionTitle({ phase: "final", round: "F" }, translate), "Finale");
  });
});
