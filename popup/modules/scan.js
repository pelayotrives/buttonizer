export function scanCurrentPageButtons() {
  function extractShadowColor(boxShadow) {
    if (!boxShadow || boxShadow === "none") {
      return "";
    }

    const match = boxShadow.match(/(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})/);
    return match ? match[0] : "";
  }

  function buildSelector(node) {
    if (node.id) {
      return `#${node.id}`;
    }

    const parts = [];
    let current = node;

    while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 4) {
      let selector = current.nodeName.toLowerCase();

      if (current.classList && current.classList.length > 0) {
        selector += `.${Array.from(current.classList).slice(0, 2).join(".")}`;
        parts.unshift(selector);
        break;
      }

      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((child) => child.nodeName === current.nodeName);
        if (siblings.length > 1) {
          selector += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        }
      }

      parts.unshift(selector);
      current = current.parentElement;
    }

    return parts.join(" > ");
  }

  function getVisibleButtonLabel(node) {
    const rawLabel = node.innerText || node.textContent || node.value || "";
    return rawLabel.replace(/\s+/g, " ").trim();
  }

  function getButtonLabel(node, index) {
    const rawLabel =
      getVisibleButtonLabel(node) ||
      node.getAttribute("aria-label") ||
      node.getAttribute("title") ||
      `Button ${index + 1}`;

    return rawLabel.replace(/\s+/g, " ").trim() || `Button ${index + 1}`;
  }

  function getClassSignature(node) {
    return Array.from(node.classList || [])
      .filter(Boolean)
      .sort()
      .join(".");
  }

  function serializeStyledSubtree(root) {
    const clone = cloneWithComputedStyles(root, 0);
    return clone ? clone.outerHTML : root.outerHTML;
  }

  function cloneWithComputedStyles(node, depth) {
    if (!(node instanceof Element) || depth > 6) {
      return null;
    }

    const clone = node.cloneNode(false);
    const computedStyle = window.getComputedStyle(node);
    clone.setAttribute("style", serializeComputedStyle(computedStyle));

    const children = Array.from(node.childNodes).slice(0, 40);
    children.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        clone.appendChild(document.createTextNode(child.textContent || ""));
        return;
      }

      const styledChild = cloneWithComputedStyles(child, depth + 1);
      if (styledChild) {
        clone.appendChild(styledChild);
      }
    });

    return clone;
  }

  function serializeComputedStyle(style) {
    const properties = Array.from(style);
    return properties
      .map((property) => `${property}:${style.getPropertyValue(property)};`)
      .join("");
  }

  function normalizeButtonLabel(label) {
    return String(label || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function isAriaHidden(node) {
    return node.closest("[aria-hidden='true'], [hidden], template") !== null;
  }

  function nodeSpecificityScore(node) {
    let score = 0;
    if (node.tagName === "BUTTON") score += 4;
    if (node.id) score += 2;
    if (node.classList) score += Math.min(2, node.classList.length);
    if (node.querySelector("svg, img")) score += 1;
    if (node.getAttribute("aria-label")) score += 1;
    return score;
  }

  function parseAlpha(colorValue) {
    if (!colorValue || colorValue === "transparent") {
      return 0;
    }

    const rgbaMatch = colorValue.match(/rgba?\(([^)]+)\)/i);
    if (!rgbaMatch) {
      return colorValue === "transparent" ? 0 : 1;
    }

    const channels = rgbaMatch[1].split(",").map((part) => part.trim());
    return channels.length >= 4 ? Number(channels[3]) || 0 : 1;
  }

  function hasVisualChrome(style) {
    const hasBackground = parseAlpha(style.backgroundColor) > 0 || (style.backgroundImage && style.backgroundImage !== "none");
    const hasBorder =
      style.borderStyle &&
      style.borderStyle !== "none" &&
      style.borderStyle !== "hidden" &&
      parseFloat(style.borderWidth || "0") > 0 &&
      parseAlpha(style.borderColor) > 0;
    const hasShadow = Boolean(style.boxShadow && style.boxShadow !== "none");

    return hasBackground || hasBorder || hasShadow;
  }

  function isLowValueButton(node, label, visibleLabel, rect, computedStyle) {
    const normalized = normalizeButtonLabel(label);
    const normalizedVisible = normalizeButtonLabel(visibleLabel);
    const hasGraphic = Boolean(node.querySelector("svg, img"));
    const looksTiny = rect.width <= 60 && rect.height <= 60;
    const looksUtilitySized = rect.width <= 88 && rect.height <= 72;
    const textLength = normalized.replace(/[^\p{L}\p{N}]/gu, "").length;
    const visibleTextLength = normalizedVisible.replace(/[^\p{L}\p{N}]/gu, "").length;
    const symbolOnly = normalized.length <= 1 && !/[\p{L}\p{N}]/u.test(normalized);
    const hasChrome = hasVisualChrome(computedStyle);
    const isInputButton = node.tagName === "INPUT";
    const disposable = [
      "close",
      "cerrar",
      "dismiss",
      "clear",
      "borrar",
      "delete",
      "remove",
      "cancel",
      "skip",
      "dismiss ad",
      "menu",
      "open menu",
      "more",
      "more options",
      "search",
      "previous",
      "next",
      "back",
      "forward",
      "x",
    ].includes(normalized);

    if (rect.width < 20 || rect.height < 20) return true;
    if (isAriaHidden(node)) return true;
    if (!normalized && !hasGraphic) return true;
    if (symbolOnly && looksTiny) return true;
    if (disposable && looksUtilitySized) return true;
    if (node.disabled && looksUtilitySized) return true;

    if (!isInputButton && visibleTextLength === 0) return true;
    if (!hasChrome && visibleTextLength <= 3) return true;
    if (visibleTextLength <= 1 && looksUtilitySized) return true;
    if (hasGraphic && visibleTextLength <= 3) return true;
    if (node.getAttribute("role") === "button" && visibleTextLength <= 3) return true;
    if (textLength <= 2 && looksTiny && !hasGraphic) return true;

    return false;
  }

  function buildDedupeKey(node, label, rect, computedStyle) {
    const roundedWidth = Math.max(1, Math.round(rect.width / 4) * 4);
    const roundedHeight = Math.max(1, Math.round(rect.height / 4) * 4);
    const background = computedStyle.backgroundColor || "transparent";
    const color = computedStyle.color || "inherit";
    const radius = computedStyle.borderRadius || "0px";
    const weight = computedStyle.fontWeight || "400";

    return [
      normalizeButtonLabel(label),
      node.tagName.toLowerCase(),
      node.getAttribute("type") || "",
      getClassSignature(node),
      roundedWidth,
      roundedHeight,
      background,
      color,
      radius,
      weight,
    ].join("|");
  }

  const candidates = Array.from(
    document.querySelectorAll("button, input[type='button'], input[type='submit'], [role='button']")
  )
    .filter((node) => {
      const rect = node.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(node);
      const visibleLabel = getVisibleButtonLabel(node);
      const label = getButtonLabel(node, 0);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        computedStyle.visibility !== "hidden" &&
        computedStyle.display !== "none" &&
        computedStyle.opacity !== "0" &&
        !isLowValueButton(node, label, visibleLabel, rect, computedStyle)
      );
    })
    .slice(0, 120);

  const candidateRecords = candidates.map((node, index) => {
    const rect = node.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(node);
    const backgroundColor = computedStyle.backgroundColor;
    const textColor = computedStyle.color;
    const borderColor = computedStyle.borderColor;
    const shadowColor = extractShadowColor(computedStyle.boxShadow);
    const measuredWidth = Math.round(rect.width);
    const measuredHeight = Math.round(rect.height);
    const label = getButtonLabel(node, index);

    return {
      specificity: nodeSpecificityScore(node),
      dedupeKey: buildDedupeKey(node, label, rect, computedStyle),
      record: {
        label,
        pageTitle: document.title || "Untitled page",
        pageUrl: window.location.href,
        hostname: window.location.hostname,
        selector: buildSelector(node),
        outerHtml: node.outerHTML.slice(0, 1200),
        previewHtml: serializeStyledSubtree(node),
        width: rect.width,
        height: rect.height,
        palette: [backgroundColor, textColor, borderColor, shadowColor],
        styles: {
          fontFamily: computedStyle.fontFamily,
          fontSize: computedStyle.fontSize,
          fontWeight: computedStyle.fontWeight,
          lineHeight: computedStyle.lineHeight,
          color: textColor,
          background: computedStyle.background,
          backgroundColor,
          backgroundImage: computedStyle.backgroundImage,
          backgroundPosition: computedStyle.backgroundPosition,
          backgroundSize: computedStyle.backgroundSize,
          backgroundRepeat: computedStyle.backgroundRepeat,
          border: computedStyle.border,
          borderColor,
          borderWidth: computedStyle.borderWidth,
          borderStyle: computedStyle.borderStyle,
          borderRadius: computedStyle.borderRadius,
          boxShadow: computedStyle.boxShadow,
          outline: computedStyle.outline,
          outlineOffset: computedStyle.outlineOffset,
          padding: computedStyle.padding,
          display: computedStyle.display,
          alignItems: computedStyle.alignItems,
          justifyContent: computedStyle.justifyContent,
          gap: computedStyle.gap,
          textAlign: computedStyle.textAlign,
          minWidth: computedStyle.minWidth !== "0px" ? computedStyle.minWidth : `${measuredWidth}px`,
          minHeight: computedStyle.minHeight !== "0px" ? computedStyle.minHeight : `${measuredHeight}px`,
          width: computedStyle.width,
          height: computedStyle.height,
          letterSpacing: computedStyle.letterSpacing,
          textTransform: computedStyle.textTransform,
        },
      },
    };
  });

  const deduped = [];
  const seen = new Map();

  candidateRecords.forEach((candidate) => {
    const existingIndex = seen.get(candidate.dedupeKey);
    if (existingIndex === undefined) {
      seen.set(candidate.dedupeKey, deduped.length);
      deduped.push(candidate);
      return;
    }

    if (candidate.specificity > deduped[existingIndex].specificity) {
      deduped[existingIndex] = candidate;
    }
  });

  const buttons = deduped.map((candidate) => candidate.record).slice(0, 80);

  return {
    pageTitle: document.title || "Untitled page",
    pageUrl: window.location.href,
    buttons,
  };
}
