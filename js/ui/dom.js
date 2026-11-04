// Small DOM helper. Text is always set via textContent, never parsed as HTML.

export function element(tag, { className, text, attributes } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  for (const [name, value] of Object.entries(attributes ?? {})) node.setAttribute(name, value);
  node.append(...children);
  return node;
}
