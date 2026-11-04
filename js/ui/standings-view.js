// Renders the group standings table. Sheet content is only inserted as text.

import { PHASES } from "../domain/match-contract.js";
import { computeStandings } from "../domain/standings.js";
import { element } from "./dom.js";

const COLUMNS = [
  { key: "colPosition", title: "colPositionTitle", className: "col-position", value: (row) => (row.sharedPosition ? `${row.position}=` : String(row.position)) },
  { key: "colCoach", className: "col-coach", value: (row) => row.coach, isRowHeader: true },
  { key: "colPlayed", title: "colPlayedTitle", value: (row) => String(row.played) },
  { key: "colWon", title: "colWonTitle", value: (row) => String(row.won) },
  { key: "colDrawn", title: "colDrawnTitle", value: (row) => String(row.drawn) },
  { key: "colLost", title: "colLostTitle", value: (row) => String(row.lost) },
  { key: "colTd", title: "colTdTitle", className: "col-pair", value: (row) => `${row.tdFor}–${row.tdAgainst}` },
  { key: "colCas", title: "colCasTitle", className: "col-pair", value: (row) => `${row.casFor}–${row.casAgainst}` },
  { key: "colNet", title: "colNetTitle", value: (row) => formatSigned(row.tiebreaker) },
  { key: "colPoints", title: "colPointsTitle", className: "col-points", value: (row) => String(row.points) },
];

function formatSigned(value) {
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${Math.abs(value)}`;
  return "0";
}

function headerCell(column, translate) {
  const label = translate(column.key);
  const content = column.title
    ? element("abbr", { text: label, attributes: { title: translate(column.title) } })
    : label;
  return element("th", { className: column.className, attributes: { scope: "col" } }, [content]);
}

function bodyCell(column, row) {
  const tag = column.isRowHeader ? "th" : "td";
  const attributes = column.isRowHeader ? { scope: "row" } : {};
  return element(tag, { className: column.className, text: column.value(row), attributes });
}

/** Replaces the container's content with the standings table. */
export function renderStandings(container, { matches, issues }, { translate }) {
  const standings = computeStandings(matches, issues);

  if (standings.rows.length === 0) {
    container.replaceChildren(element("p", { className: "notice", text: translate("standingsEmpty") }));
    return;
  }

  const totalGroupMatches = matches.filter((match) => match.phase === PHASES.GROUP).length;

  const table = element("table", { className: "standings" }, [
    element("caption", { className: "visually-hidden", text: translate("standingsCaption") }),
    element("thead", {}, [element("tr", {}, COLUMNS.map((column) => headerCell(column, translate)))]),
    element(
      "tbody",
      {},
      standings.rows.map((row) => element("tr", {}, COLUMNS.map((column) => bodyCell(column, row)))),
    ),
  ]);

  // Focusable so keyboard users can scroll the table on narrow screens.
  const scroller = element(
    "div",
    { className: "table-scroll", attributes: { tabindex: "0", role: "region", "aria-label": translate("standingsScrollLabel") } },
    [table],
  );

  const notes = [
    element("p", {
      className: "standings-progress",
      text: translate("standingsProgress", { counted: standings.countedMatches, total: totalGroupMatches }),
    }),
    element("p", { className: "standings-note", text: translate("standingsRule") }),
  ];
  if (standings.hasSharedPositions) {
    notes.push(element("p", { className: "standings-note", text: translate("standingsShared") }));
  }

  container.replaceChildren(scroller, ...notes);
}
