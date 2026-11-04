// Interface texts and locale-aware formatting (Dutch and English).
// Competition data (names, races, rulesets) is never translated.

export const LANGUAGES = Object.freeze(["nl", "en"]);
export const DEFAULT_LANGUAGE = "nl";

const TRANSLATIONS = Object.freeze({
  nl: {
    tagline: "Blood Bowl league Utrecht – Amersfoort",
    scheduleHeading: "Speelschema",
    languageLabel: "Taal",
    loading: "Gegevens laden…",
    loadError: "De gegevens konden niet worden geladen.",
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
    scheduledOn: "Gepland op {date}",
    casualties: "CAS",
    ruleset: "Regels",
    slotGroup: "Nr. {position} groepsfase",
    slotWinner: "Winnaar {match}",
    matchSemifinal: "halve finale",
    matchFinal: "finale",
    slotSharedPosition: "Gedeelde positie, nog niet beslist",
    slotAfterDraw: "Gelijkspel, nog geen winnaar",
    playoffDraw: "Gelijkspel: winnaar nog niet vastgesteld",
    toBeDetermined: "Nog onbekend",
    qualificationNote: "Nr. 1–{places} plaatsen zich voor de halve finales.",
    qualificationBoundary: "? = gedeelde positie op de grens. Nog niet beslist wie doorgaat.",
    issuesSummary: "Fouten in het spreadsheet ({count})",
    issueRow: "Regel {row}",
    issueHeader: "Kopregel",
    footer: "De gegevens komen uit het spreadsheet van de competitieleider.",
    standingsHeading: "Stand",
    standingsCaption: "Stand groepsfase",
    standingsProgress: "{counted} van {total} wedstrijden gespeeld",
    standingsEmpty: "Er staan nog geen coaches in het schema.",
    standingsShared: "= gedeelde positie. Verdere tiebreakers zijn nog niet vastgesteld.",
    standingsRule: "Winst 3, gelijk 1, verlies 0 punten. Bij gelijke punten telt het saldo: TD-saldo plus CAS-saldo.",
    standingsScrollLabel: "Stand (horizontaal scrollbaar)",
    colPosition: "#",
    colPositionTitle: "Positie",
    colCoach: "Coach",
    colPlayed: "Gesp",
    colPlayedTitle: "Gespeeld",
    colWon: "W",
    colWonTitle: "Winst",
    colDrawn: "G",
    colDrawnTitle: "Gelijk",
    colLost: "V",
    colLostTitle: "Verlies",
    colTd: "TD",
    colTdTitle: "Touchdowns voor – tegen",
    colCas: "CAS",
    colCasTitle: "Casualties voor – tegen",
    colNet: "Saldo",
    colNetTitle: "TD-saldo + CAS-saldo",
    colPoints: "Ptn",
    colPointsTitle: "Punten",
  },
  en: {
    tagline: "Blood Bowl league Utrecht – Amersfoort",
    scheduleHeading: "Schedule",
    languageLabel: "Language",
    loading: "Loading data…",
    loadError: "The data could not be loaded.",
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
    scheduledOn: "Scheduled for {date}",
    casualties: "CAS",
    ruleset: "Rules",
    slotGroup: "Group stage #{position}",
    slotWinner: "Winner {match}",
    matchSemifinal: "semifinal",
    matchFinal: "final",
    slotSharedPosition: "Shared position, not yet decided",
    slotAfterDraw: "Draw, no winner yet",
    playoffDraw: "Draw: winner not yet determined",
    toBeDetermined: "To be determined",
    qualificationNote: "Places 1–{places} qualify for the semifinals.",
    qualificationBoundary: "? = shared position at the cut-off. Not yet decided who goes through.",
    issuesSummary: "Errors in the spreadsheet ({count})",
    issueRow: "Row {row}",
    issueHeader: "Header row",
    footer: "Data comes from the league administrator's spreadsheet.",
    standingsHeading: "Standings",
    standingsCaption: "Group stage standings",
    standingsProgress: "{counted} of {total} matches played",
    standingsEmpty: "There are no coaches in the schedule yet.",
    standingsShared: "= shared position. Further tiebreakers have not been established yet.",
    standingsRule: "Win 3, draw 1, loss 0 points. Equal points are separated by net TD plus net CAS.",
    standingsScrollLabel: "Standings (scrolls horizontally)",
    colPosition: "#",
    colPositionTitle: "Position",
    colCoach: "Coach",
    colPlayed: "P",
    colPlayedTitle: "Played",
    colWon: "W",
    colWonTitle: "Won",
    colDrawn: "D",
    colDrawnTitle: "Drawn",
    colLost: "L",
    colLostTitle: "Lost",
    colTd: "TD",
    colTdTitle: "Touchdowns for – against",
    colCas: "CAS",
    colCasTitle: "Casualties for – against",
    colNet: "Net",
    colNetTitle: "Net TD + net CAS",
    colPoints: "Pts",
    colPointsTitle: "Points",
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

/**
 * Names a playoff match for display, e.g. "halve finale 1" / "semifinal 1".
 * Falls back to the match id for matches without a playoff label.
 * @param {Map<string, { phase: string, number: number|null }>} labels see playoffMatchLabels
 */
export function describeMatch(matchId, labels, translate) {
  const label = labels.get(matchId);
  if (!label) return matchId;
  const name = translate(label.phase === "final" ? "matchFinal" : "matchSemifinal");
  return label.number === null ? name : `${name} ${label.number}`;
}

/** Describes a qualification slot (`group:N` / `winner:ID`) for display. */
export function describeSlot(slot, translate, labels = new Map()) {
  const separator = slot.indexOf(":");
  const kind = slot.slice(0, separator);
  const value = slot.slice(separator + 1);
  if (kind === "group") return translate("slotGroup", { position: value });
  if (kind === "winner") return translate("slotWinner", { match: describeMatch(value, labels, translate) });
  return slot;
}

export function sectionTitle(section, translate) {
  if (section.phase === "semifinal") return translate("semifinal");
  if (section.phase === "final") return translate("final");
  return translate("round", { round: section.round });
}

export { TRANSLATIONS };
