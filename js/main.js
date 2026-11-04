// Entry point: picks the language, loads the sheet and renders standings and schedule.

import { MATCHES_SHEET } from "./config.js";
import { loadMatches } from "./data/matches-source.js";
import { LANGUAGES, createTranslator, resolveLanguage } from "./ui/i18n.js";
import { renderLoadError, renderLoading, renderSchedule } from "./ui/schedule-view.js";
import { renderStandings } from "./ui/standings-view.js";

const standingsContainer = document.querySelector("#standings-content");
const scheduleContainer = document.querySelector("#schedule-content");
const languageButtons = document.querySelectorAll("[data-language]");

let language = resolveLanguage({
  search: window.location.search,
  preferredLanguages: navigator.languages ?? [navigator.language],
});
let data = null;

function translateStaticText(translate) {
  document.documentElement.lang = language;
  for (const node of document.querySelectorAll("[data-i18n]")) {
    node.textContent = translate(node.dataset.i18n);
  }
  for (const button of languageButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.language === language));
  }
}

function render() {
  const translate = createTranslator(language);
  translateStaticText(translate);
  if (data) {
    renderStandings(standingsContainer, data, { translate });
    renderSchedule(scheduleContainer, data, { language, translate });
  }
}

function setLanguage(next) {
  if (!LANGUAGES.includes(next) || next === language) return;
  language = next;
  const url = new URL(window.location.href);
  url.searchParams.set("lang", language);
  window.history.replaceState(null, "", url);
  render();
}

// Loading and error messages appear once, in the first section.
async function load() {
  renderLoading(standingsContainer, createTranslator(language));
  scheduleContainer.replaceChildren();
  try {
    data = await loadMatches(MATCHES_SHEET);
    render();
  } catch (error) {
    console.error(error);
    renderLoadError(standingsContainer, createTranslator(language), load);
  }
}

for (const button of languageButtons) {
  button.addEventListener("click", () => setLanguage(button.dataset.language));
}

render();
load();
