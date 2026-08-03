const loadedFontFaces = new Set();

function ensureFontFaces(cssText) {
  if (!cssText || loadedFontFaces.has(cssText)) return;
  const style = document.createElement("style");
  style.dataset.buttonizerFont = "true";
  style.textContent = cssText;
  document.head.appendChild(style);
  loadedFontFaces.add(cssText);
}

function mountPreviewHtml(container, html) {
  const previewDocument = new DOMParser().parseFromString(html, "text/html");
  previewDocument.querySelectorAll("script, iframe, object, embed, link, style").forEach((node) => node.remove());
  previewDocument.querySelectorAll("*").forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on") || name === "srcdoc" || (/^(href|src|action|formaction)$/.test(name) && /^javascript:/i.test(value))) {
        node.removeAttribute(attribute.name);
      }
    });
  });
  const root = previewDocument.body.firstElementChild;
  container.replaceChildren(root ? document.importNode(root, true) : document.createTextNode(""));
  return container.firstElementChild;
}

export function renderPreviewSurface(container, item, fitToStage = false) {
  ensureFontFaces(item.fontFaceCss);
  if (item.previewHtml) {
    const root = mountPreviewHtml(container, item.previewHtml);
    if (root && fitToStage) {
      preparePreviewNode(root);
      fitPreviewToStage(container, root, item);
    }
    return;
  }

  const fallback = document.createElement("button");
  fallback.type = "button";
  fallback.textContent = item.label || "Button";
  applyPreviewStyle(fallback, item.styles, item.width, item.height);
  container.replaceChildren(fallback);
  if (fitToStage) {
    preparePreviewNode(fallback);
    fitPreviewToStage(container, fallback, item);
  }
}

export function renderSavedButtonSurface(container, item, fitToStage = false) {
  ensureFontFaces(item.fontFaceCss);
  if (item.previewHtml) {
    const root = mountPreviewHtml(container, item.previewHtml);
    if (root) {
      preparePreviewNode(root);
      if (fitToStage) {
        fitPreviewToStage(container, root, item);
      }
    }
    return;
  }

  const fallback = document.createElement("button");
  fallback.type = "button";
  fallback.textContent = item.label || "Button";
  applyPreviewStyle(fallback, item.styles, item.width, item.height);
  preparePreviewNode(fallback);
  if (fitToStage) {
    container.replaceChildren(fallback);
    fitPreviewToStage(container, fallback, item);
    return;
  }
  container.replaceChildren(fallback);
}

export function preparePreviewNode(root) {
  root.style.pointerEvents = "none";
  root.style.userSelect = "none";
}

export function fitPreviewToStage(container, root, item) {
  const naturalWidth = Math.max(1, Math.round(item.width || root.getBoundingClientRect().width || 1));
  const naturalHeight = Math.max(1, Math.round(item.height || root.getBoundingClientRect().height || 1));

  window.requestAnimationFrame(() => {
    const availableWidth = Math.max(120, container.clientWidth - 16);
    const availableHeight = Math.max(56, (container.clientHeight || naturalHeight) - 16);
    const scale = Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight);

    // CSS zoom changes layout dimensions without replacing the captured component styles.
    root.style.zoom = String(scale);
    container.style.minHeight = `${Math.max(64, Math.round(naturalHeight * scale) + 8)}px`;
    container.scrollLeft = 0;
    container.scrollTop = 0;
  });
}

export function applyPreviewStyle(node, styles, width = 0, height = 0) {
  node.style.fontFamily = styles.fontFamily || "Arial, sans-serif";
  node.style.fontSize = styles.fontSize || "14px";
  node.style.fontWeight = styles.fontWeight || "400";
  node.style.lineHeight = styles.lineHeight || "normal";
  node.style.color = styles.color || "inherit";
  node.style.background = styles.background || styles.backgroundColor || "transparent";
  node.style.backgroundImage = styles.backgroundImage || "none";
  node.style.backgroundPosition = styles.backgroundPosition || "0% 0%";
  node.style.backgroundSize = styles.backgroundSize || "auto";
  node.style.backgroundRepeat = styles.backgroundRepeat || "repeat";
  node.style.border = styles.border || `${styles.borderWidth || "0px"} ${styles.borderStyle || "solid"} ${styles.borderColor || "transparent"}`;
  node.style.borderRadius = styles.borderRadius || "0px";
  node.style.boxShadow = styles.boxShadow || "none";
  node.style.outline = styles.outline || "none";
  node.style.outlineOffset = styles.outlineOffset || "0px";
  node.style.padding = styles.padding || "10px 16px";
  node.style.display = styles.display || "inline-flex";
  node.style.alignItems = styles.alignItems || "center";
  node.style.justifyContent = styles.justifyContent || "center";
  node.style.gap = styles.gap || "0px";
  node.style.textAlign = styles.textAlign || "center";
  node.style.minWidth = styles.minWidth || (width ? `${Math.round(width)}px` : "auto");
  node.style.minHeight = styles.minHeight || (height ? `${Math.round(height)}px` : "auto");
  node.style.width = styles.width && styles.width !== "auto" ? styles.width : "auto";
  node.style.height = styles.height && styles.height !== "auto" ? styles.height : "auto";
  node.style.boxSizing = styles.boxSizing || "border-box";
  node.style.letterSpacing = styles.letterSpacing || "normal";
  node.style.textTransform = styles.textTransform || "none";
}
