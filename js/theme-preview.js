// TEMPORARY: lets reviewers compare colour schemes via ?theme=a|b|c and a
// small switcher. Remove this file (and its <script> tag) once a theme is chosen.

const THEMES = ["a", "b", "c"];
const params = new URLSearchParams(window.location.search);
const current = THEMES.includes(params.get("theme")) ? params.get("theme") : "";

if (current) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `css/themes/theme-${current}.css`;
  document.head.append(link);
}

const switcher = document.createElement("nav");
switcher.setAttribute("aria-label", "Theme preview");
switcher.style.cssText =
  "position:fixed;right:0.5rem;bottom:0.5rem;z-index:10;display:flex;gap:0.25rem;" +
  "padding:0.4rem;background:#000;border:1px solid #666;border-radius:0.4rem;font:600 0.8rem system-ui";

for (const theme of ["", ...THEMES]) {
  const url = new URL(window.location.href);
  if (theme) url.searchParams.set("theme", theme);
  else url.searchParams.delete("theme");
  const link = document.createElement("a");
  link.href = url.toString();
  link.textContent = theme ? theme.toUpperCase() : "Now";
  link.style.cssText = `padding:0.2rem 0.5rem;border-radius:0.25rem;text-decoration:none;color:${
    theme === current ? "#000;background:#fff" : "#fff"
  }`;
  if (theme === current) link.setAttribute("aria-current", "true");
  switcher.append(link);
}

document.body.append(switcher);
