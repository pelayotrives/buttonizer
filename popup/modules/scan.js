export function scanCurrentPageButtons() {
  const selector = "button, input[type='button'], input[type='submit'], input[type='reset'], [role='button']";
  const utilityLabels = new Set([
    "back", "cancel", "cerrar", "clear", "close", "delete", "dismiss", "forward",
    "menu", "more", "more options", "next", "open menu", "previous", "remove", "search",
  ]);

  function collectCandidates(root, output = []) {
    output.push(...root.querySelectorAll(selector));
    root.querySelectorAll("*").forEach((element) => {
      if (element.shadowRoot) collectCandidates(element.shadowRoot, output);
    });
    return output;
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeLabel(value) {
    return cleanText(value).toLocaleLowerCase();
  }

  function getVisibleLabel(node) {
    if (node instanceof HTMLInputElement) return cleanText(node.value);
    return cleanText(node.innerText || node.textContent);
  }

  function getLabel(node, index) {
    return getVisibleLabel(node) || cleanText(node.getAttribute("aria-label")) ||
      cleanText(node.getAttribute("title")) || `Button ${index + 1}`;
  }

  function parseAlpha(color) {
    if (!color || color === "transparent") return 0;
    const match = color.match(/rgba?\(([^)]+)\)/i);
    if (!match) return 1;
    const channels = match[1].split(/[,/]/).map((part) => part.trim());
    return channels.length >= 4 ? Number(channels[3]) || 0 : 1;
  }

  function hasVisualChrome(style) {
    const hasBackground = parseAlpha(style.backgroundColor) > 0 || style.backgroundImage !== "none";
    const hasBorder = ["Top", "Right", "Bottom", "Left"].some((side) =>
      !["none", "hidden"].includes(style[`border${side}Style`]) &&
      Number.parseFloat(style[`border${side}Width`] || "0") > 0 &&
      parseAlpha(style[`border${side}Color`]) > 0
    );
    return hasBackground || hasBorder || style.boxShadow !== "none";
  }

  function getComposedParent(node) {
    if (node.parentElement) return node.parentElement;
    const root = node.getRootNode();
    return root instanceof ShadowRoot ? root.host : null;
  }

  function isRendered(node, style, rect) {
    if (rect.width < 2 || rect.height < 2 || node.getClientRects().length === 0) return false;
    let current = node;
    while (current instanceof Element) {
      const currentStyle = current === node ? style : window.getComputedStyle(current);
      if (
        currentStyle.display === "none" || currentStyle.visibility === "hidden" ||
        currentStyle.visibility === "collapse" || Number(currentStyle.opacity) === 0 ||
        current.hidden || current.getAttribute("aria-hidden") === "true" || current.localName === "template"
      ) return false;
      current = getComposedParent(current);
    }
    return true;
  }

  function isNestedDuplicate(node) {
    const isNative = node.localName === "button" || node instanceof HTMLInputElement;
    if (isNative) return false;

    if (
      node.getAttribute("role") === "button" &&
      node.localName !== "button" &&
      node.querySelector("button, input[type='button'], input[type='submit'], input[type='reset']")
    ) return true;
    const parent = getComposedParent(node);
    return Boolean(parent?.closest?.(selector));
  }

  function isMeaningful(node, label, visibleLabel, rect, style) {
    if (!isRendered(node, style, rect) || isNestedDuplicate(node)) return false;
    const visibleCharacters = normalizeLabel(visibleLabel).replace(/[^\p{L}\p{N}]/gu, "").length;
    const isInput = node instanceof HTMLInputElement;
    const isNative = node.localName === "button" || isInput;
    const utilitySized = rect.width <= 72 && rect.height <= 64;

    // Keep reusable controls, not isolated icon/navigation utilities.
    if (!isInput && visibleCharacters < 2) return false;
    if (utilityLabels.has(normalizeLabel(label)) && utilitySized) return false;
    if (!isNative && (!hasVisualChrome(style) || visibleCharacters < 3)) return false;
    if (node.disabled && utilitySized) return false;
    return true;
  }

  function buildSelector(node) {
    if (node.id) return `#${CSS.escape(node.id)}`;
    const parts = [];
    let current = node;
    while (current instanceof Element && parts.length < 4) {
      let part = current.localName;
      const classes = Array.from(current.classList || [])
        .filter((name) => !/[0-9a-f]{6,}/i.test(name)).slice(0, 2);
      if (classes.length) {
        part += classes.map((name) => `.${CSS.escape(name)}`).join("");
        parts.unshift(part);
        break;
      }
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((child) => child.localName === current.localName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
      parts.unshift(part);
      const root = current.getRootNode();
      current = parent || (root instanceof ShadowRoot ? root.host : null);
    }
    return parts.join(" > ");
  }

  function serializeStyle(style) {
    return Array.from(style, (property) => {
      const priority = style.getPropertyPriority(property);
      return `${property}:${style.getPropertyValue(property)}${priority ? " !important" : ""};`;
    }).join("");
  }

  function pseudoContent(style) {
    const content = style.content;
    if (!content || content === "none" || content === "normal") return null;
    if (/^(["']).*\1$/.test(content)) return content.slice(1, -1).replace(/\\(["'\\])/g, "$1");
    return "";
  }

  function clonePseudo(node, pseudo) {
    const style = window.getComputedStyle(node, pseudo);
    const content = pseudoContent(style);
    if (content === null) return null;
    const clone = document.createElement("span");
    clone.setAttribute("aria-hidden", "true");
    clone.setAttribute("style", serializeStyle(style));
    clone.textContent = content;
    return clone;
  }

  function cloneChildren(node) {
    if (node.localName === "slot" && typeof node.assignedNodes === "function") {
      const assigned = node.assignedNodes({ flatten: true });
      if (assigned.length) return assigned;
    }
    return node.shadowRoot ? Array.from(node.shadowRoot.childNodes) : Array.from(node.childNodes);
  }

  function cloneStyled(node, depth = 0) {
    if (!(node instanceof Element) || depth > 10) return null;
    const clone = node.localName === "slot" ? document.createElement("span") : node.cloneNode(false);
    clone.removeAttribute("autofocus");
    clone.setAttribute("style", serializeStyle(window.getComputedStyle(node)));
    clone.setAttribute("tabindex", "-1");

    const before = clonePseudo(node, "::before");
    if (before) clone.appendChild(before);
    cloneChildren(node).slice(0, 80).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        clone.appendChild(document.createTextNode(child.textContent || ""));
      } else {
        const childClone = cloneStyled(child, depth + 1);
        if (childClone) clone.appendChild(childClone);
      }
    });
    const after = clonePseudo(node, "::after");
    if (after) clone.appendChild(after);
    return clone;
  }

  function dedupeKey(label, rect, style) {
    return [
      normalizeLabel(label), Math.round(rect.width / 8) * 8, Math.round(rect.height / 8) * 8,
      style.backgroundColor, style.backgroundImage, style.color, style.border, style.borderRadius,
      style.boxShadow, style.fontFamily, style.fontSize, style.fontWeight,
    ].join("|");
  }

  function quality(node, style) {
    return (node.localName === "button" ? 6 : 0) +
      (node instanceof HTMLInputElement ? 5 : 0) + (hasVisualChrome(style) ? 3 : 0) +
      (node.id ? 2 : 0) + Math.min(2, node.classList.length);
  }

  function shadowColor(boxShadow) {
    if (!boxShadow || boxShadow === "none") return "";
    return boxShadow.match(/(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})/)?.[0] || "";
  }

  const candidates = [...new Set(collectCandidates(document))].map((node, index) => {
    const rect = node.getBoundingClientRect();
    const style = window.getComputedStyle(node);
    const visibleLabel = getVisibleLabel(node);
    return { node, rect, style, visibleLabel, label: getLabel(node, index) };
  }).filter(({ node, label, visibleLabel, rect, style }) => isMeaningful(node, label, visibleLabel, rect, style));

  const records = new Map();
  candidates.slice(0, 160).forEach(({ node, rect, style, label }) => {
    const key = dedupeKey(label, rect, style);
    const candidate = {
      quality: quality(node, style),
      record: {
        label,
        pageTitle: document.title || "Untitled page",
        pageUrl: window.location.href,
        hostname: window.location.hostname,
        selector: buildSelector(node),
        outerHtml: node.outerHTML.slice(0, 4000),
        previewHtml: cloneStyled(node)?.outerHTML || node.outerHTML,
        width: rect.width,
        height: rect.height,
        palette: [style.backgroundColor, style.color, style.borderColor, shadowColor(style.boxShadow)],
        styles: {
          fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight,
          lineHeight: style.lineHeight, color: style.color, background: style.background,
          backgroundColor: style.backgroundColor, backgroundImage: style.backgroundImage,
          backgroundPosition: style.backgroundPosition, backgroundSize: style.backgroundSize,
          backgroundRepeat: style.backgroundRepeat, border: style.border, borderColor: style.borderColor,
          borderWidth: style.borderWidth, borderStyle: style.borderStyle, borderRadius: style.borderRadius,
          boxShadow: style.boxShadow, outline: style.outline, outlineOffset: style.outlineOffset,
          padding: style.padding, display: style.display, alignItems: style.alignItems,
          justifyContent: style.justifyContent, gap: style.gap, textAlign: style.textAlign,
          minWidth: style.minWidth, minHeight: style.minHeight, width: style.width, height: style.height,
          boxSizing: style.boxSizing, letterSpacing: style.letterSpacing, textTransform: style.textTransform,
        },
      },
    };
    const existing = records.get(key);
    if (!existing || candidate.quality > existing.quality) records.set(key, candidate);
  });

  return {
    pageTitle: document.title || "Untitled page",
    pageUrl: window.location.href,
    buttons: Array.from(records.values(), ({ record }) => record).slice(0, 80),
  };
}
