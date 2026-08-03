export function renderPalette(container, palette, onCopyColor) {
  container.replaceChildren();
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
    swatch.addEventListener("click", () => {
      const hexValue = colorToHex(colorValue);
      if (onCopyColor) {
        Promise.resolve(onCopyColor(hexValue)).catch(() => {});
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
    fontFaceCss: item.fontFaceCss || "",
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
      boxSizing: item.styles?.boxSizing || "border-box",
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
  } catch {
    return pageUrl;
  }
}

export function highlightCssSnippet(source) {
  const lines = escapeHtml(source).split("\n");
  const highlightedLines = lines.map((line) => {
    const declaration = line.match(/^([ \t]*)([a-z-]+)(:[ \t]*)([^;\n]*)(;)$/);
    if (!declaration) {
      return line;
    }

    const [, indent, property, colon, value, semicolon] = declaration;
    return indent +
      '<span class="token token-property">' + property + '</span>' +
      colon + '<span class="token token-value">' + value + '</span>' +
      '<span class="token token-punctuation">' + semicolon + '</span>';
  });

  return highlightedLines
    .join("\n")
    .replace(/[{}]/g, '<span class="token token-punctuation">$&</span>');
}

export function highlightHtmlSnippet(source) {
  const input = String(source || "");
  let lastIndex = 0;
  let result = "";
  let tagStart = input.indexOf("<");

  while (tagStart !== -1) {
    const tagEnd = findTagEnd(input, tagStart);
    if (tagEnd === -1) {
      break;
    }

    if (tagStart > lastIndex) {
      result += escapeHtml(input.slice(lastIndex, tagStart));
    }

    const rawTag = input.slice(tagStart, tagEnd + 1);
    result += highlightHtmlTag(rawTag);
    lastIndex = tagEnd + 1;
    tagStart = input.indexOf("<", lastIndex);
  }

  if (lastIndex < input.length) {
    result += escapeHtml(input.slice(lastIndex));
  }

  return result;
}

function findTagEnd(source, startIndex) {
  let quote = "";
  for (let index = startIndex + 1; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) {
        quote = "";
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === ">") {
      return index;
    }
  }
  return -1;
}

function readTagName(rawTag, startIndex) {
  let index = startIndex;
  while (index < rawTag.length && /\s/.test(rawTag[index])) {
    index += 1;
  }

  const nameStart = index;
  while (index < rawTag.length && !/[\s/>]/.test(rawTag[index])) {
    index += 1;
  }

  return {
    name: rawTag.slice(nameStart, index) || "div",
    end: index,
  };
}

function highlightHtmlTag(rawTag) {
  const isClosing = rawTag.startsWith("</");
  const isSelfClosing = rawTag.endsWith("/>");
  const tagInfo = readTagName(rawTag, isClosing ? 2 : 1);
  const open = isClosing ? "&lt;/" : "&lt;";
  const close = isSelfClosing ? "/&gt;" : "&gt;";

  if (isClosing) {
    return '<span class="token token-punctuation">' + open +
      '</span><span class="token token-tag">' + escapeHtml(tagInfo.name) +
      '</span><span class="token token-punctuation">&gt;</span>';
  }

  const closingLength = isSelfClosing ? 2 : 1;
  const attrSource = rawTag.slice(tagInfo.end, rawTag.length - closingLength).trim();
  const highlightedAttrs = attrSource ? " " + highlightHtmlAttributes(attrSource) : "";

  return '<span class="token token-punctuation">' + open +
    '</span><span class="token token-tag">' + escapeHtml(tagInfo.name) +
    '</span>' + highlightedAttrs +
    '<span class="token token-punctuation">' + close + '</span>';
}

function highlightHtmlAttributes(source) {
  const parts = [];
  let index = 0;

  while (index < source.length) {
    const whitespaceStart = index;
    while (index < source.length && /\s/.test(source[index])) {
      index += 1;
    }
    if (index > whitespaceStart) {
      parts.push(escapeHtml(source.slice(whitespaceStart, index)));
    }
    if (index >= source.length) {
      break;
    }

    const nameStart = index;
    while (index < source.length && !/[\s=]/.test(source[index])) {
      index += 1;
    }
    const name = source.slice(nameStart, index);
    if (!name) {
      parts.push(escapeHtml(source[index]));
      index += 1;
      continue;
    }

    parts.push('<span class="token token-attribute">' + escapeHtml(name) + '</span>');

    while (index < source.length && /\s/.test(source[index])) {
      index += 1;
    }
    if (source[index] !== "=") {
      continue;
    }

    parts.push('<span class="token token-punctuation">=</span>');
    index += 1;
    while (index < source.length && /\s/.test(source[index])) {
      index += 1;
    }

    const quote = source[index] === '"' || source[index] === "'" ? source[index] : "";
    const valueStart = index;
    if (quote) {
      index += 1;
      while (index < source.length && source[index] !== quote) {
        index += 1;
      }
      if (index < source.length) {
        index += 1;
      }
    } else {
      while (index < source.length && !/\s/.test(source[index])) {
        index += 1;
      }
    }

    parts.push('<span class="token token-string">' +
      escapeHtml(source.slice(valueStart, index)) + '</span>');
  }

  return parts.join("");
}

export function buildCssSnippet(item) {
  const selectorName = `.buttonizer-${toKebabCase(item.label || "button")}`;
  const rules = [
    ["font-family", normalizeFontFamily(item.styles.fontFamily)],
    ["font-size", item.styles.fontSize || "14px"],
    ["font-weight", item.styles.fontWeight || "400"],
    ["line-height", item.styles.lineHeight || "normal"],
    ["color", item.styles.color || "inherit"],
    ["background", item.styles.background || item.styles.backgroundColor || "transparent"],
    ["border", formatBorder(item.styles)],
    ["border-radius", item.styles.borderRadius || "0px"],
    ["box-shadow", item.styles.boxShadow || "none"],
    ["padding", item.styles.padding || "10px 16px"],
    ["box-sizing", item.styles.boxSizing || "border-box"],
    ["display", item.styles.display || "inline-flex"],
    ["align-items", item.styles.alignItems || "center"],
    ["justify-content", item.styles.justifyContent || "center"],
    ["gap", item.styles.gap || "0px"],
    ["letter-spacing", item.styles.letterSpacing || "normal"],
    ["text-transform", item.styles.textTransform || "none"],
  ];

  const body = rules.map(([property, value]) => `  ${property}: ${value};`).join("\n");
  return `${selectorName} {\n${body}\n}`;
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

  const raw = String(fontFamily || "Arial, sans-serif").replaceAll(";", "");
  const tokens = raw.match(/"[^"]+"|'[^']+'|[^,]+/g) || [];
  const uniqueFamilies = [];
  const seen = new Set();

  tokens.forEach((token) => {
    const cleaned = stripWrappingQuotes(String(token).replaceAll(";", ""));

    if (!cleaned || /\bfallback\b/i.test(cleaned)) {
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
    .map((part) => formatFamilyToken(part, genericFamilies))
    .join(", ")
    .trim();
}

function formatFamilyToken(part, genericFamilies) {
  const isGenericFamily = genericFamilies.has(part.toLowerCase());
  const isUnquotedFamily = /^[a-z-]+$/i.test(part);
  if (isGenericFamily || isUnquotedFamily) {
    return part;
  }
  return "\"" + part + "\"";
}

export function toKebabCase(value) {
  return String(value || "button")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "") || "button";
}

function stripWrappingQuotes(value) {
  const trimmed = value.trim();
  const hasDoubleQuotes = trimmed.codePointAt(0) === 34 && trimmed.codePointAt(trimmed.length - 1) === 34;
  const hasSingleQuotes = trimmed.codePointAt(0) === 39 && trimmed.codePointAt(trimmed.length - 1) === 39;
  if (hasDoubleQuotes || hasSingleQuotes) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function compactFontFamily(fontFamily) {
  const normalized = normalizeFontFamily(fontFamily);
  const firstFamily = normalized.split(",")[0] || "";
  return stripWrappingQuotes(firstFamily) || "Unknown font";
}

export function formatBorder(styles) {
  return styles.border || `${styles.borderWidth || "0px"} ${styles.borderStyle || "solid"} ${styles.borderColor || "transparent"}`;
}

export function isVisibleColor(value) {
  return typeof value === "string" && value.trim() !== "" && value !== "rgba(0, 0, 0, 0)" && value !== "transparent";
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll(String.fromCodePoint(39), "&#39;");
}
