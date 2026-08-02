export function renderPalette(container, palette, onCopyColor) {
  container.innerHTML = "";
  const uniqueColors = [...new Set(palette.filter(isVisibleColor))].slice(0, 6);

  if (uniqueColors.length === 0) {
    const chip = document.createElement("span");
    chip.className = "meta-chip";
    chip.textContent = "No palette";
    container.appendChild(chip);
    return;
  }

  uniqueColors.forEach((colorValue) => {
    const swatch = document.createElement("button");
    swatch.className = "palette-swatch";
    swatch.type = "button";
    swatch.style.background = colorValue;
    swatch.title = `Copy ${colorValue}`;
    swatch.setAttribute("aria-label", `Copy color ${colorValue}`);
    swatch.addEventListener("click", async () => {
      const hexValue = colorToHex(colorValue);
      if (onCopyColor) {
        await onCopyColor(hexValue);
      }
    });
    container.appendChild(swatch);
  });
}

export function colorToHex(colorValue) {
  const context = document.createElement("canvas").getContext("2d");
  if (!context) {
    return colorValue;
  }

  context.fillStyle = "#000000";
  context.fillStyle = colorValue;
  const normalized = context.fillStyle;

  if (normalized.startsWith("#")) {
    return normalized.toUpperCase();
  }

  const rgbMatch = normalized.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!rgbMatch) {
    return colorValue;
  }

  const [, r, g, b] = rgbMatch;
  return `#${[r, g, b]
    .map((value) => Number(value).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

export function normalizeButtonRecord(item) {
  return {
    id: buildStableId(item),
    label: item.label || "Unnamed button",
    pageTitle: item.pageTitle || "Unknown page",
    pageUrl: item.pageUrl || "",
    hostname: item.hostname || "",
    selector: item.selector || "",
    outerHtml: item.outerHtml || "",
    width: Math.round(item.width || 0),
    height: Math.round(item.height || 0),
    palette: Array.isArray(item.palette) ? item.palette : [],
    previewHtml: item.previewHtml || "",
    styles: {
      fontFamily: item.styles?.fontFamily || "Arial, sans-serif",
      fontSize: item.styles?.fontSize || "14px",
      fontWeight: item.styles?.fontWeight || "400",
      color: item.styles?.color || "",
      background: item.styles?.background || "",
      backgroundColor: item.styles?.backgroundColor || "",
      backgroundImage: item.styles?.backgroundImage || "",
      backgroundPosition: item.styles?.backgroundPosition || "",
      backgroundSize: item.styles?.backgroundSize || "",
      backgroundRepeat: item.styles?.backgroundRepeat || "",
      border: item.styles?.border || "",
      borderColor: item.styles?.borderColor || "",
      borderWidth: item.styles?.borderWidth || "0px",
      borderStyle: item.styles?.borderStyle || "solid",
      borderRadius: item.styles?.borderRadius || "0px",
      boxShadow: item.styles?.boxShadow || "none",
      outline: item.styles?.outline || "none",
      outlineOffset: item.styles?.outlineOffset || "0px",
      padding: item.styles?.padding || "10px 16px",
      display: item.styles?.display || "inline-flex",
      alignItems: item.styles?.alignItems || "center",
      justifyContent: item.styles?.justifyContent || "center",
      gap: item.styles?.gap || "0px",
      lineHeight: item.styles?.lineHeight || "normal",
      textAlign: item.styles?.textAlign || "center",
      minWidth: item.styles?.minWidth || "",
      minHeight: item.styles?.minHeight || "",
      width: item.styles?.width || "auto",
      height: item.styles?.height || "auto",
      letterSpacing: item.styles?.letterSpacing || "normal",
      textTransform: item.styles?.textTransform || "none",
    },
  };
}

export function buildStableId(item) {
  return [
    item.pageUrl || "",
    item.selector || "",
    item.label || "",
    Math.round(item.width || 0),
    Math.round(item.height || 0),
  ].join("|");
}

export function formatDomainLabel(pageUrl) {
  if (!pageUrl) {
    return "Unknown domain";
  }

  try {
    const url = new URL(pageUrl);
    return `${url.origin}/*`;
  } catch (error) {
    return pageUrl;
  }
}

export function highlightCssSnippet(source) {
  let html = escapeHtml(source);

  html = html.replace(/(\.[a-z0-9-]+)(\s*\{)/gi, '<span class="token token-selector">$1</span>$2');
  html = html.replace(/(^|
)(\s*)([a-z-]+)(:\s*)([^;]+)(;)/g, (_match, lineStart, indent, property, colon, value, semicolon) => {
    return `${lineStart}${indent}<span class="token token-property">${property}</span>${colon}<span class="token token-value">${value}</span><span class="token token-punctuation">${semicolon}</span>`;
  });
  html = html.replace(/[{}]/g, '<span class="token token-punctuation">$&</span>');

  return html;
}

export function highlightHtmlSnippet(source) {
  const input = String(source || "");
  const tagPattern = /<[^>]+>/g;
  let lastIndex = 0;
  let result = "";

  for (const match of input.matchAll(tagPattern)) {
    const [rawTag] = match;
    const matchIndex = match.index || 0;

    if (matchIndex > lastIndex) {
      result += escapeHtml(input.slice(lastIndex, matchIndex));
    }

    result += highlightHtmlTag(rawTag);
    lastIndex = matchIndex + rawTag.length;
  }

  if (lastIndex < input.length) {
    result += escapeHtml(input.slice(lastIndex));
  }

  return result;
}

function highlightHtmlTag(rawTag) {
  const isClosing = /^<\//.test(rawTag);
  const isSelfClosing = /\/>$/.test(rawTag);
  const tagNameMatch = rawTag.match(/^<\/?\s*([a-z0-9-]+)/i);
  const tagName = tagNameMatch ? tagNameMatch[1] : "div";
  const open = isClosing ? "&lt;/" : "&lt;";
  const close = isSelfClosing ? "/&gt;" : "&gt;";

  if (isClosing) {
    return `<span class="token token-punctuation">${open}</span><span class="token token-tag">${escapeHtml(tagName)}</span><span class="token token-punctuation">&gt;</span>`;
  }

  const attrSource = rawTag
    .replace(/^<\s*[a-z0-9-]+/i, "")
    .replace(/\/?\s*>$/, "")
    .trim();

  const highlightedAttrs = attrSource ? ` ${highlightHtmlAttributes(attrSource)}` : "";

  return `<span class="token token-punctuation">${open}</span><span class="token token-tag">${escapeHtml(tagName)}</span>${highlightedAttrs}<span class="token token-punctuation">${close}</span>`;
}

function highlightHtmlAttributes(source) {
  const attrPattern = /([:@a-zA-Z0-9_-]+)(\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;
  const parts = [];
  let lastIndex = 0;

  for (const match of source.matchAll(attrPattern)) {
    const [rawAttr, name, assignment = ""] = match;
    const matchIndex = match.index || 0;

    if (matchIndex > lastIndex) {
      parts.push(escapeHtml(source.slice(lastIndex, matchIndex)));
    }

    let rendered = `<span class="token token-attribute">${escapeHtml(name)}</span>`;

    if (assignment) {
      const eqIndex = assignment.indexOf("=");
      const value = assignment.slice(eqIndex + 1).trim();
      rendered += `<span class="token token-punctuation">=</span><span class="token token-string">${escapeHtml(value)}</span>`;
    }

    parts.push(rendered);
    lastIndex = matchIndex + rawAttr.length;
  }

  if (lastIndex < source.length) {
    parts.push(escapeHtml(source.slice(lastIndex)));
  }

  return parts.join("");
}

export function buildCssSnippet(item) {
  const selectorName = `.buttonizer-${toKebabCase(item.label || "button")}`;
  const rules = [
    ["font-family", normalizeFontFamily(item.styles.fontFamily)],
    ["font-size", item.styles.fontSize || "14px"],
    ["font-weight", item.styles.fontWeight || "400"],
    ["color", item.styles.color || "inherit"],
    ["background-color", item.styles.backgroundColor || "transparent"],
    ["border", formatBorder(item.styles)],
    ["border-radius", item.styles.borderRadius || "0px"],
    ["box-shadow", item.styles.boxShadow || "none"],
    ["padding", item.styles.padding || "10px 16px"],
  ];

  const body = rules.map(([property, value]) => `  ${property}: ${value};`).join("
");
  return `${selectorName} {
${body}
}`;
}

export function normalizeFontFamily(fontFamily) {
  const genericFamilies = new Set([
    "serif",
    "sans-serif",
    "monospace",
    "cursive",
    "fantasy",
    "system-ui",
    "ui-serif",
    "ui-sans-serif",
    "ui-monospace",
    "ui-rounded",
    "emoji",
    "math",
    "fangsong",
    "-apple-system",
  ]);

  const raw = String(fontFamily || "Arial, sans-serif").replace(/;/g, "");
  const tokens = raw.match(/"[^"]+"|'[^']+'|[^,]+/g) || [];
  const uniqueFamilies = [];
  const seen = new Set();

  tokens.forEach((token) => {
    const cleaned = String(token)
      .replace(/;/g, "")
      .replace(/^[\s"']+/, "")
      .replace(/[\s"']+$/, "")
      .trim();

    if (!cleaned || /fallback/i.test(cleaned)) {
      return;
    }

    const normalized = cleaned.toLowerCase();
    if (seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    uniqueFamilies.push(cleaned);
  });

  return uniqueFamilies
    .map((part) => (genericFamilies.has(part.toLowerCase()) || /^[a-z-]+$/i.test(part) ? part : `"${part}"`))
    .join(", ")
    .replace(/"\s*;/g, '"')
    .trim();
}

export function toKebabCase(value) {
  return String(value || "button")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "button";
}

export function compactFontFamily(fontFamily) {
  const normalized = normalizeFontFamily(fontFamily);
  return normalized.split(",")[0]?.replace(/^[\s"']+/, "").replace(/[\s"']+$/, "").trim() || "Unknown font";
}

export function formatBorder(styles) {
  return `${styles.borderWidth || "0px"} ${styles.borderStyle || "solid"} ${styles.borderColor || "transparent"}`;
}

export function isVisibleColor(value) {
  return typeof value === "string" && value.trim() !== "" && value !== "rgba(0, 0, 0, 0)" && value !== "transparent";
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
