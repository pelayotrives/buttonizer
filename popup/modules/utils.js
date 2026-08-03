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

function parseColorChannel(value) {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return 0;
  const channel = value.trim().endsWith("%") ? numeric * 2.55 : numeric;
  return Math.round(Math.max(0, Math.min(255, channel)));
}

function parseRgbColor(value) {
  const open = value.indexOf("(");
  const close = value.lastIndexOf(")");
  if (open === -1 || close <= open) return null;
  const channels = value.slice(open + 1, close).replaceAll("/", " ").split(/[,\s]+/).filter(Boolean);
  if (channels.length < 3) return null;
  return channels.slice(0, 3).map(parseColorChannel);
}

function resolveColorForConversion(colorValue, context) {
  context.fillStyle = "#000000";
  context.fillStyle = colorValue;
  const canvasColor = context.fillStyle;
  if (canvasColor !== "#000000" || String(colorValue).trim().toLowerCase() === "#000000") return canvasColor;

  const probe = document.createElement("span");
  probe.style.color = colorValue;
  if (!probe.style.color) return canvasColor;
  document.body.appendChild(probe);
  const resolved = window.getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

export function colorToHex(colorValue) {
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return "#000000";
  const normalized = resolveColorForConversion(String(colorValue || ""), context);
  if (normalized.startsWith("#")) {
    const hex = normalized.slice(1);
    if (hex.length === 3 || hex.length === 6) return ("#" + hex).toUpperCase();
  }
  const channels = parseRgbColor(normalized);
  if (!channels) return "#000000";
  return "#" + channels.map((channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase();
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

function parseCssDeclaration(line) {
  if (!line.endsWith(";")) return null;

  let propertyStart = 0;
  while (propertyStart < line.length && isCssWhitespace(line[propertyStart])) propertyStart += 1;
  let propertyEnd = propertyStart;
  while (propertyEnd < line.length && isCssPropertyCharacter(line[propertyEnd])) propertyEnd += 1;
  if (propertyEnd === propertyStart || line[propertyEnd] !== ":") return null;

  let valueStart = propertyEnd + 1;
  while (valueStart < line.length - 1 && isCssWhitespace(line[valueStart])) valueStart += 1;
  return {
    indent: line.slice(0, propertyStart),
    property: line.slice(propertyStart, propertyEnd),
    colon: line.slice(propertyEnd, valueStart),
    value: line.slice(valueStart, -1),
    semicolon: ";",
  };
}

function isCssWhitespace(character) {
  return character === " " || character === "\t";
}

function isCssPropertyCharacter(character) {
  return (character >= "a" && character <= "z") || character === "-";
}

export function highlightCssSnippet(source) {
  const lines = escapeHtml(source).split("\n");
  const highlightedLines = lines.map((line) => {
    const declaration = parseCssDeclaration(line);
    if (!declaration) {
      return line;
    }

    const { indent, property, colon, value, semicolon } = declaration;
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

function skipHtmlWhitespace(source, index) {
  while (index < source.length && isHtmlWhitespace(source[index])) index += 1;
  return index;
}

function isHtmlWhitespace(character) {
  return character === " " || character === "\t" || character === "\n" || character === "\r" || character === "\f";
}

function readHtmlAttributeName(source, index) {
  const start = index;
  while (index < source.length && !isHtmlWhitespace(source[index]) && source[index] !== "=") index += 1;
  return { value: source.slice(start, index), end: index };
}

function readHtmlAttributeValue(source, index) {
  const quote = source.codePointAt(index);
  const isQuoted = quote === 34 || quote === 39;
  const start = index;
  if (isQuoted) {
    index += 1;
    while (index < source.length && source.codePointAt(index) !== quote) index += 1;
    if (index < source.length) index += 1;
  } else {
    while (index < source.length && !isHtmlWhitespace(source[index])) index += 1;
  }
  return { value: source.slice(start, index), end: index };
}

function highlightHtmlAttributes(source) {
  const parts = [];
  let index = 0;

  while (index < source.length) {
    const whitespaceEnd = skipHtmlWhitespace(source, index);
    if (whitespaceEnd > index) parts.push(escapeHtml(source.slice(index, whitespaceEnd)));
    index = whitespaceEnd;
    if (index >= source.length) break;

    const name = readHtmlAttributeName(source, index);
    if (!name.value) {
      parts.push(escapeHtml(source[index]));
      index += 1;
      continue;
    }
    parts.push("<span class=\"token token-attribute\">" + escapeHtml(name.value) + "</span>");
    index = skipHtmlWhitespace(source, name.end);
    if (source[index] !== "=") continue;

    parts.push("<span class=\"token token-punctuation\">=</span>");
    index = skipHtmlWhitespace(source, index + 1);
    const value = readHtmlAttributeValue(source, index);
    parts.push("<span class=\"token token-string\">" + escapeHtml(value.value) + "</span>");
    index = value.end;
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

function trimHyphenEdges(value) {
  let start = 0;
  let end = value.length;
  while (start < end && value[start] === "-") start += 1;
  while (end > start && value[end - 1] === "-") end -= 1;
  return value.slice(start, end);
}

export function toKebabCase(value) {
  const kebab = String(value || "button")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  return trimHyphenEdges(kebab) || "button";
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
