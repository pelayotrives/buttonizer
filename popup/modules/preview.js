export function renderPreviewSurface(container, item, fitToStage = false) {
  if (item.previewHtml) {
    container.innerHTML = item.previewHtml;
    const root = container.firstElementChild;
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
  if (item.previewHtml) {
    container.innerHTML = item.previewHtml;
    const root = container.firstElementChild;
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
  root.style.maxWidth = "none";
  root.style.minWidth = "0";
  root.style.boxSizing = "border-box";
  root.style.margin = "0";
  root.style.flexShrink = "0";
}

export function fitPreviewToStage(container, root, item) {
  const naturalWidth = Math.max(1, Math.round(item.width || root.getBoundingClientRect().width || 1));
  const naturalHeight = Math.max(1, Math.round(item.height || root.getBoundingClientRect().height || 1));

  window.requestAnimationFrame(() => {
    const availableWidth = Math.max(120, container.clientWidth - 16);
    const availableHeight = Math.max(56, (container.clientHeight || naturalHeight) - 16);
    const scale = Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight);

    root.style.width = `${naturalWidth}px`;
    root.style.maxWidth = "none";
    root.style.transform = `scale(${scale})`;
    root.style.transformOrigin = "center center";
    root.style.display = root.style.display && root.style.display !== "inline" ? root.style.display : "inline-flex";
    root.style.alignSelf = "center";
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
  node.style.letterSpacing = styles.letterSpacing || "normal";
  node.style.textTransform = styles.textTransform || "none";
}
