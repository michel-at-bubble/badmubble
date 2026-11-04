// Renders the schedule. Sheet content is only ever inserted as text, never as HTML.

import { RESULT_STATUS } from "../domain/match-contract.js";
import { buildScheduleSections, issuesByRow } from "../domain/schedule.js";
import { describeSlot, formatDate, formatMonth, sectionTitle } from "./i18n.js";

function element(tag, { className, text, attributes } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  for (const [name, value] of Object.entries(attributes ?? {})) node.setAttribute(name, value);
  node.append(...children);
  return node;
}

function renderParticipant(match, side, translate) {
  const coach = match[`${side}_coach`];
  const slot = match[`${side}_slot`];
  const race = match[`${side}_race`];

  const children = [];
  if (coach !== "") {
    children.push(element("span", { className: "coach", text: coach }));
    if (slot !== "") children.push(element("span", { className: "slot", text: describeSlot(slot, translate) }));
  } else {
    const label = slot !== "" ? describeSlot(slot, translate) : translate("toBeDetermined");
    children.push(element("span", { className: "coach coach--unknown", text: label }));
  }
  if (race !== "") children.push(element("span", { className: "race", text: race }));

  return element("div", { className: `participant participant--${side}` }, children);
}

function renderOutcome(match, isInvalid, translate) {
  if (isInvalid) {
    return element("div", { className: "outcome outcome--invalid", text: translate("statusInvalid") });
  }
  if (match.resultStatus === RESULT_STATUS.COMPLETE) {
    return element("div", { className: "outcome outcome--complete" }, [
      element("span", { className: "score", text: `${match.home_td} – ${match.away_td}` }),
      element("span", {
        className: "casualties",
        text: `${translate("casualties")} ${match.home_cas} – ${match.away_cas}`,
      }),
    ]);
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

function renderMatchDetails(match, language, translate) {
  const details = [];
  if (match.match_date !== "") {
    details.push(element("span", { text: translate("playedOn", { date: formatDate(match.match_date, language) }) }));
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

function renderMatch(match, rowIssues, language, translate) {
  const isInvalid = rowIssues.length > 0;
  const item = element("li", { className: isInvalid ? "match match--invalid" : "match" }, [
    element("div", { className: "match-line" }, [
      renderParticipant(match, "home", translate),
      renderOutcome(match, isInvalid, translate),
      renderParticipant(match, "away", translate),
    ]),
  ]);
  const details = renderMatchDetails(match, language, translate);
  if (details) item.append(details);
  return item;
}

function renderSection(section, rowIssues, language, translate) {
  const months = section.scheduledMonths.map((month) => formatMonth(month, language)).join(" / ");
  return element("section", { className: "round" }, [
    element("h3", { className: "round-title" }, [
      element("span", { text: sectionTitle(section, translate) }),
      element("span", { className: "round-month", text: months }),
    ]),
    element(
      "ol",
      { className: "match-list" },
      section.matches.map((match) => renderMatch(match, rowIssues.get(match.row) ?? [], language, translate)),
    ),
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
  const rowIssues = issuesByRow(issues);
  const children = [];

  if (issues.length > 0) children.push(renderIssues(issues, translate));
  if (sections.length === 0) {
    children.push(element("p", { className: "notice", text: translate("empty") }));
  }
  children.push(...sections.map((section) => renderSection(section, rowIssues, language, translate)));

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
