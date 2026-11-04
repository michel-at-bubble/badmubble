// Renders the schedule. Sheet content is only ever inserted as text, never as HTML.

import { PLAYOFF_PHASES, RESULT_STATUS } from "../domain/match-contract.js";
import { resolvePlayoffs } from "../domain/playoffs.js";
import { buildScheduleSections, issuesByRow } from "../domain/schedule.js";
import { element } from "./dom.js";
import { describeSlot, formatDate, formatMonth, sectionTitle } from "./i18n.js";

// Notes shown under an open playoff slot, for reasons a visitor may wonder about.
const OPEN_SLOT_NOTES = {
  "shared-position": "slotSharedPosition",
  draw: "slotAfterDraw",
};

/**
 * Who plays on one side. For playoff matches the participant comes from the
 * playoff resolution: the sheet's coach, or one derived from standings/results.
 */
function participantFor(match, side, view) {
  const slot = match[`${side}_slot`];
  const resolved = view.playoffs.participants.get(match.row)?.[side];
  if (resolved) return { coach: resolved.coach, slot, reason: resolved.reason };
  return { coach: match[`${side}_coach`], slot, reason: null };
}

function renderParticipant(match, side, view) {
  const { translate, playoffs } = view;
  const participant = participantFor(match, side, view);
  const race = match[`${side}_race`];
  const slotText = participant.slot !== "" ? describeSlot(participant.slot, translate, playoffs.labels) : "";

  const children = [];
  if (participant.coach !== "") {
    children.push(element("span", { className: "coach", text: participant.coach }));
    if (slotText !== "") children.push(element("span", { className: "slot", text: slotText }));
  } else {
    children.push(element("span", { className: "coach coach--unknown", text: slotText || translate("toBeDetermined") }));
    const note = OPEN_SLOT_NOTES[participant.reason];
    if (note) children.push(element("span", { className: "slot", text: translate(note) }));
  }
  if (race !== "") children.push(element("span", { className: "race", text: race }));

  return element("div", { className: `participant participant--${side}` }, children);
}

function renderOutcome(match, isInvalid, { translate }) {
  if (isInvalid) {
    return element("div", { className: "outcome outcome--invalid", text: translate("statusInvalid") });
  }
  if (match.resultStatus === RESULT_STATUS.COMPLETE) {
    const children = [
      element("span", { className: "score", text: `${match.home_td} – ${match.away_td}` }),
      element("span", {
        className: "casualties",
        text: `${translate("casualties")} ${match.home_cas} – ${match.away_cas}`,
      }),
    ];
    // No rule for drawn playoff matches has been established, so no winner is named.
    if (PLAYOFF_PHASES.includes(match.phase) && match.home_td === match.away_td) {
      children.push(element("span", { className: "outcome-note", text: translate("playoffDraw") }));
    }
    return element("div", { className: "outcome outcome--complete" }, children);
  }
  const key = match.resultStatus === RESULT_STATUS.PARTIAL ? "statusPartial" : "statusScheduled";
  return element("div", { className: "outcome outcome--pending", text: translate(key) });
}

// Links are only created for http(s) URLs, even if validation was bypassed,
// so a value like `javascript:` from the sheet can never become a link.
function isHttpUrl(value) {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function renderMatchDetails(match, { language, translate }) {
  const details = [];
  if (match.match_date !== "") {
    // The date may be entered before the match is played; only a complete result makes it "played".
    const key = match.resultStatus === RESULT_STATUS.COMPLETE ? "playedOn" : "scheduledOn";
    details.push(element("span", { text: translate(key, { date: formatDate(match.match_date, language) }) }));
  }
  if (match.ruleset_name !== "" || match.ruleset_url !== "") {
    const label = `${translate("ruleset")}: ${match.ruleset_name || match.ruleset_url}`;
    details.push(
      isHttpUrl(match.ruleset_url)
        ? element("a", { text: label, attributes: { href: match.ruleset_url, rel: "noopener" } })
        : element("span", { text: label }),
    );
  }
  return details.length > 0 ? element("p", { className: "match-details" }, details) : null;
}

function renderMatch(match, view) {
  const isInvalid = (view.rowIssues.get(match.row) ?? []).length > 0;
  const item = element("li", { className: isInvalid ? "match match--invalid" : "match" }, [
    element("div", { className: "match-line" }, [
      renderParticipant(match, "home", view),
      renderOutcome(match, isInvalid, view),
      renderParticipant(match, "away", view),
    ]),
  ]);
  const details = renderMatchDetails(match, view);
  if (details) item.append(details);
  return item;
}

function renderSection(section, view) {
  const months = section.scheduledMonths.map((month) => formatMonth(month, view.language)).join(" / ");
  return element("section", { className: "round" }, [
    element("h3", { className: "round-title" }, [
      element("span", { text: sectionTitle(section, view.translate) }),
      element("span", { className: "round-month", text: months }),
    ]),
    element("ol", { className: "match-list" }, section.matches.map((match) => renderMatch(match, view))),
  ]);
}

function renderIssues(issues, translate) {
  const list = element(
    "ul",
    {},
    issues.map((entry) => {
      const where = entry.row === null
        ? translate("issueHeader")
        : translate("issueRow", { row: entry.row });
      const id = entry.matchId ? ` (${entry.matchId})` : "";
      return element("li", { text: `${where}${id}: ${entry.message}` });
    }),
  );
  return element("details", { className: "issues" }, [
    element("summary", { text: translate("issuesSummary", { count: issues.length }) }),
    list,
  ]);
}

/** Replaces the container's content with the schedule. */
export function renderSchedule(container, { matches, issues }, { language, translate }) {
  const sections = buildScheduleSections(matches);
  const view = {
    language,
    translate,
    rowIssues: issuesByRow(issues),
    playoffs: resolvePlayoffs(matches, issues),
  };
  const children = [];

  if (issues.length > 0) children.push(renderIssues(issues, translate));
  if (sections.length === 0) {
    children.push(element("p", { className: "notice", text: translate("empty") }));
  }
  children.push(...sections.map((section) => renderSection(section, view)));

  container.replaceChildren(...children);
}

export function renderLoading(container, translate) {
  container.replaceChildren(element("p", { className: "notice", text: translate("loading") }));
}

export function renderLoadError(container, translate, onRetry) {
  const retry = element("button", { className: "button", text: translate("retry"), attributes: { type: "button" } });
  retry.addEventListener("click", onRetry);
  container.replaceChildren(
    element("p", { className: "notice notice--error", text: translate("loadError") }),
    retry,
  );
}
