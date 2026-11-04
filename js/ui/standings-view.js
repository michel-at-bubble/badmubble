// Renders the group standings table. Sheet content is only inserted as text.

import { PHASES } from "../domain/match-contract.js";
import { isGroupStageComplete, qualificationByCoach, qualifyingPlaces } from "../domain/playoffs.js";
import { issuesByRow } from "../domain/schedule.js";
import { computeStandings } from "../domain/standings.js";
import { element } from "./dom.js";

const COLUMNS = [
  { key: "colPosition", title: "colPositionTitle", className: "col-position", value: formatPosition },
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

function formatPosition(row) {
  const position = row.sharedPosition ? `${row.position}=` : String(row.position);
  return row.qualification === "boundary" ? `${position}?` : position;
}

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

  // Qualification follows from the group:N slots in the sheet; without playoff rows there is none.
  // A shared position across the cut-off is only flagged as undecided once the
  // group stage is over; during the season such ties are normal and temporary.
  const places = qualifyingPlaces(matches);
  const groupComplete = isGroupStageComplete(matches, issuesByRow(issues));
  const qualification = qualificationByCoach(standings.rows, places);
  const rows = standings.rows.map((row) => {
    let status = places > 0 ? qualification.get(row.coach) : null;
    if (status === "boundary" && !groupComplete) status = "open";
    return { ...row, qualification: status };
  });
  const lastQualifyingIndex = rows.findLastIndex((row) => row.qualification === "in" || row.qualification === "boundary");
  const rowClass = (row, index) =>
    [
      row.qualification ? `standings-row--${row.qualification}` : "",
      index === lastQualifyingIndex && index < rows.length - 1 ? "standings-row--cutoff" : "",
    ].filter(Boolean).join(" ");

  const table = element("table", { className: "standings" }, [
    element("caption", { className: "visually-hidden", text: translate("standingsCaption") }),
    element("thead", {}, [element("tr", {}, COLUMNS.map((column) => headerCell(column, translate)))]),
    element(
      "tbody",
      {},
      rows.map((row, index) =>
        element("tr", { className: rowClass(row, index) || undefined }, COLUMNS.map((column) => bodyCell(column, row))),
      ),
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
  if (places > 0) {
    notes.push(element("p", { className: "standings-note", text: translate("qualificationNote", { places }) }));
  }
  if (standings.hasSharedPositions) {
    notes.push(element("p", { className: "standings-note", text: translate("standingsShared") }));
  }
  if (rows.some((row) => row.qualification === "boundary")) {
    notes.push(element("p", { className: "standings-note", text: translate("qualificationBoundary") }));
  }

  container.replaceChildren(scroller, ...notes);
}
