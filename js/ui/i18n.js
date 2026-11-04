// Interface texts and locale-aware formatting (Dutch and English).
// Competition data (names, races, rulesets) is never translated.

export const LANGUAGES = Object.freeze(["nl", "en"]);
export const DEFAULT_LANGUAGE = "nl";

const TRANSLATIONS = Object.freeze({
  nl: {
    tagline: "Blood Bowl-competitie Utrecht – Amersfoort",
    scheduleHeading: "Speelschema",
    languageLabel: "Taal",
    loading: "Speelschema laden…",
    loadError: "Het speelschema kon niet worden geladen.",
    retry: "Opnieuw proberen",
    empty: "Er staan nog geen wedstrijden in het schema.",
    noscript: "Het speelschema heeft JavaScript nodig.",
    round: "Ronde {round}",
    semifinal: "Halve finales",
    final: "Finale",
    statusScheduled: "Nog te spelen",
    statusPartial: "Uitslag nog niet compleet",
    statusInvalid: "Gegevens onjuist",
    playedOn: "Gespeeld op {date}",
    casualties: "CAS",
    ruleset: "Regels",
    slotGroup: "Nr. {position} groepsfase",
    slotWinner: "Winnaar {matchId}",
    toBeDetermined: "Nog onbekend",
    issuesSummary: "Fouten in het spreadsheet ({count})",
    issueRow: "Regel {row}",
    issueHeader: "Kopregel",
    footer: "De gegevens komen uit het spreadsheet van de competitieleider.",
  },
  en: {
    tagline: "Blood Bowl league Utrecht – Amersfoort",
    scheduleHeading: "Schedule",
    languageLabel: "Language",
    loading: "Loading schedule…",
    loadError: "The schedule could not be loaded.",
    retry: "Try again",
    empty: "There are no matches in the schedule yet.",
    noscript: "The schedule requires JavaScript.",
    round: "Round {round}",
    semifinal: "Semifinals",
    final: "Final",
    statusScheduled: "To be played",
    statusPartial: "Result not yet complete",
    statusInvalid: "Invalid data",
    playedOn: "Played on {date}",
    casualties: "CAS",
    ruleset: "Rules",
    slotGroup: "Group stage #{position}",
    slotWinner: "Winner {matchId}",
    toBeDetermined: "To be determined",
    issuesSummary: "Errors in the spreadsheet ({count})",
    issueRow: "Row {row}",
    issueHeader: "Header row",
    footer: "Data comes from the league administrator's spreadsheet.",
  },
});

/**
 * Picks the interface language: explicit `?lang=` first, then the browser's
 * preferred languages, then Dutch.
 */
export function resolveLanguage({ search = "", preferredLanguages = [] } = {}) {
  const requested = new URLSearchParams(search).get("lang");
  if (LANGUAGES.includes(requested)) return requested;

  for (const tag of preferredLanguages) {
    const base = String(tag).toLowerCase().split("-")[0];
    if (LANGUAGES.includes(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}

/** Returns a translator for the given language; `{name}` placeholders are filled from params. */
export function createTranslator(language) {
  const texts = TRANSLATIONS[language] ?? TRANSLATIONS[DEFAULT_LANGUAGE];
  return (key, params = {}) => {
    const template = texts[key];
    if (template === undefined) throw new Error(`Missing translation "${key}" for "${language}".`);
    return template.replace(/\{(\w+)\}/g, (placeholder, name) =>
      name in params ? String(params[name]) : placeholder,
    );
  };
}

/** Formats a validated `YYYY-MM` value, e.g. "november 2026" / "November 2026". */
export function formatMonth(value, language) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(language, { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}

/** Formats a validated `YYYY-MM-DD` value, e.g. "14 november 2026" / "14 November 2026". */
export function formatDate(value, language) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(language === "en" ? "en-GB" : language, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** Describes a qualification slot (`group:N` / `winner:ID`) for display. */
export function describeSlot(slot, translate) {
  const [kind, value] = slot.split(":");
  if (kind === "group") return translate("slotGroup", { position: value });
  if (kind === "winner") return translate("slotWinner", { matchId: value });
  return slot;
}

export function sectionTitle(section, translate) {
  if (section.phase === "semifinal") return translate("semifinal");
  if (section.phase === "final") return translate("final");
  return translate("round", { round: section.round });
}

export { TRANSLATIONS };
