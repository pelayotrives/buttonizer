const STORAGE_KEY = "buttonizer_saved_buttons";

const state = {
  detectedButtons: [],
  savedButtons: [],
  pageTitle: "No page scanned yet",
  pageUrl: "Scan a page to inspect visible buttons",
  status: "Idle",
  detectedIndex: 0,
  selectedSavedId: null,
  toastTimer: null,
  contextMenuId: null,
};

const elements = {
  scanPageButton: document.getElementById("scanPageButton"),
  saveAllButton: document.getElementById("saveAllButton"),
  saveCurrentButton: document.getElementById("saveCurrentButton"),
  clearLibraryButton: document.getElementById("clearLibraryButton"),
  archivePrevButton: document.getElementById("archivePrevButton"),
  archiveNextButton: document.getElementById("archiveNextButton"),
  archiveCountBadge: document.getElementById("archiveCountBadge"),
  savedContextMenu: document.getElementById("savedContextMenu"),
  savedContextDeleteButton: document.getElementById("savedContextDeleteButton"),
  capturePrevButton: document.getElementById("capturePrevButton"),
  captureNextButton: document.getElementById("captureNextButton"),
  removeSavedButton: document.getElementById("removeSavedButton"),
  copySavedCssButton: document.getElementById("copySavedCssButton"),
  copyMarkupButton: document.getElementById("copyMarkupButton"),
  statusMessage: document.getElementById("statusMessage"),
  toastMessage: document.getElementById("toastMessage"),
  scanCountBadge: document.getElementById("scanCountBadge"),
  pageFacts: document.getElementById("pageFacts"),
  detectedEmpty: document.getElementById("detectedEmpty"),
  detectedInspector: document.getElementById("detectedInspector"),
  inspectorTitle: document.getElementById("inspectorTitle"),
  inspectorSubtitle: document.getElementById("inspectorSubtitle"),
  inspectorPreview: document.getElementById("inspectorPreview"),
  inspectorSize: document.getElementById("inspectorSize"),
  inspectorFont: document.getElementById("inspectorFont"),
  inspectorWeight: document.getElementById("inspectorWeight"),
  inspectorBackground: document.getElementById("inspectorBackground"),
  inspectorText: document.getElementById("inspectorText"),
  inspectorBorder: document.getElementById("inspectorBorder"),
  inspectorRadius: document.getElementById("inspectorRadius"),
  inspectorShadow: document.getElementById("inspectorShadow"),
  inspectorPalette: document.getElementById("inspectorPalette"),
  inspectorSelector: document.getElementById("inspectorSelector"),
  inspectorMarkup: document.getElementById("inspectorMarkup"),
  savedDetailsCss: document.getElementById("savedDetailsCss"),
  savedEmpty: document.getElementById("savedEmpty"),
  savedLibrary: document.getElementById("savedLibrary"),
  savedPreview: document.getElementById("savedPreview"),
  savedDetails: document.getElementById("savedDetails"),
  savedDetailsTitle: document.getElementById("savedDetailsTitle"),
  savedDetailsFont: document.getElementById("savedDetailsFont"),
  savedDetailsBackground: document.getElementById("savedDetailsBackground"),
  savedDetailsBorder: document.getElementById("savedDetailsBorder"),
  savedDetailsShadow: document.getElementById("savedDetailsShadow"),
  savedDetailsPalette: document.getElementById("savedDetailsPalette"),
};

bootstrap().catch((error) => {
  console.error(error);
  setStatus(error.message || "Buttonizer could not start.", "Error");
  showToast("Buttonizer could not start.");
});

async function bootstrap() {
  bindEvents();
  await loadSavedButtons();
  renderAll();
}

function bindEvents() {
  elements.scanPageButton.addEventListener("click", handleScanPage);
  elements.saveAllButton.addEventListener("click", handleSaveAll);
  elements.saveCurrentButton.addEventListener("click", handleSaveCurrent);
  elements.clearLibraryButton.addEventListener("click", handleClearLibrary);
  elements.capturePrevButton.addEventListener("click", () => moveDetected(-1));
  elements.captureNextButton.addEventListener("click", () => moveDetected(1));
  elements.archivePrevButton.addEventListener("click", () => moveSaved(-1));
  elements.archiveNextButton.addEventListener("click", () => moveSaved(1));
  elements.savedPreview.addEventListener("click", handleSavedPreviewClick);
  elements.savedPreview.addEventListener("keydown", handleSavedPreviewKeyDown);
  elements.savedPreview.addEventListener("contextmenu", handleSavedPreviewContextMenu);
  elements.removeSavedButton.addEventListener("click", handleRemoveSelectedSaved);
  elements.copySavedCssButton.addEventListener("click", handleCopySavedCss);
  elements.copyMarkupButton.addEventListener("click", handleCopyMarkup);
  elements.savedContextDeleteButton.addEventListener("click", handleContextDelete);
  document.addEventListener("click", handleGlobalPointerDown);
  document.addEventListener("contextmenu", handleGlobalContextMenu);
  document.addEventListener("keydown", handleGlobalKeyDown);
}

async function loadSavedButtons() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  state.savedButtons = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
  state.selectedSavedId = state.savedButtons[0]?.id || null;
}

async function persistSavedButtons() {
  await chrome.storage.local.set({ [STORAGE_KEY]: state.savedButtons });
}

function setStatus(message, status) {
  state.status = status;
  elements.statusMessage.textContent = message;
  renderPageFacts();
}

function showToast(message) {
  if (state.toastTimer) {
    clearTimeout(state.toastTimer);
  }

  elements.toastMessage.textContent = message;
  elements.toastMessage.hidden = false;
  window.requestAnimationFrame(() => {
    elements.toastMessage.classList.add("is-visible");
  });

  state.toastTimer = window.setTimeout(() => {
    elements.toastMessage.classList.remove("is-visible");
    window.setTimeout(() => {
      if (!elements.toastMessage.classList.contains("is-visible")) {
        elements.toastMessage.hidden = true;
      }
    }, 180);
    state.toastTimer = null;
  }, 1800);
}

function renderAll() {
  renderPageFacts();
  renderCaptureInspector();
  renderSavedLibrary();
  elements.saveAllButton.disabled = state.detectedButtons.length === 0;
  elements.clearLibraryButton.disabled = state.savedButtons.length === 0;
}

function renderPageFacts() {
  const facts = [
    { label: "Title", value: state.pageTitle },
    { label: "Domain", value: state.pageUrl },
  ];

  elements.pageFacts.innerHTML = facts
    .map(
      (fact) => `
        <div class="fact-card">
          <span class="fact-card__label">${escapeHtml(fact.label)}</span>
          <p class="fact-card__value">${escapeHtml(fact.value)}</p>
        </div>
      `
    )
    .join("");
}

function renderCaptureInspector() {
  const count = state.detectedButtons.length;
  elements.scanCountBadge.textContent = count === 0 ? "0 found" : `${state.detectedIndex + 1} / ${count}`;
  elements.capturePrevButton.disabled = count <= 1;
  elements.captureNextButton.disabled = count <= 1;
  elements.detectedEmpty.hidden = count > 0;
  elements.detectedInspector.hidden = count === 0;
  elements.saveCurrentButton.disabled = count === 0;
  elements.copyMarkupButton.disabled = count === 0;

  if (count === 0) {
    return;
  }

  const item = state.detectedButtons[state.detectedIndex];
  renderInspector(item);
}

function renderInspector(item) {
  elements.inspectorTitle.textContent = item.label || "Unnamed button";
  elements.inspectorSubtitle.textContent = `${item.pageTitle || "Unknown page"} · ${item.hostname || "Local page"}`;
  renderPreviewSurface(item, true);

  elements.inspectorSize.textContent = `${item.width}px × ${item.height}px`;
  elements.inspectorFont.textContent = compactFontFamily(item.styles.fontFamily);
  elements.inspectorWeight.textContent = item.styles.fontWeight || "400";
  elements.inspectorBackground.textContent = item.styles.backgroundColor || "Transparent";
  elements.inspectorText.textContent = item.styles.color || "Inherited";
  elements.inspectorBorder.textContent = formatBorder(item.styles);
  elements.inspectorRadius.textContent = item.styles.borderRadius || "0px";
  elements.inspectorShadow.textContent = item.styles.boxShadow || "None";
  elements.inspectorSelector.textContent = item.selector || "No selector available";
  elements.inspectorMarkup.innerHTML = highlightHtmlSnippet(item.outerHtml || "<button></button>");

  renderPalette(elements.inspectorPalette, item.palette || []);
}

function renderSavedLibrary() {
  elements.savedEmpty.hidden = state.savedButtons.length > 0;
  elements.savedLibrary.hidden = state.savedButtons.length === 0;
  elements.savedDetails.hidden = state.savedButtons.length === 0;
  elements.copySavedCssButton.disabled = state.savedButtons.length === 0;
  elements.archivePrevButton.disabled = state.savedButtons.length <= 1;
  elements.archiveNextButton.disabled = state.savedButtons.length <= 1;

  if (state.savedButtons.length === 0) {
    hideSavedContextMenu();
    state.selectedSavedId = null;
    elements.archiveCountBadge.textContent = "0 saved";
    elements.savedPreview.replaceChildren();
    return;
  }

  if (!state.savedButtons.some((item) => item.id === state.selectedSavedId)) {
    state.selectedSavedId = state.savedButtons[0].id;
  }

  const selectedIndex = state.savedButtons.findIndex((item) => item.id === state.selectedSavedId);
  const selectedItem = state.savedButtons[selectedIndex] || state.savedButtons[0];
  elements.archiveCountBadge.textContent = `${selectedIndex + 1} / ${state.savedButtons.length}`;
  renderSavedButtonSurface(elements.savedPreview, selectedItem, true);
  renderSavedDetails(selectedItem);
}

function renderSavedDetails(item) {
  if (!item) {
    elements.savedDetails.hidden = true;
    return;
  }

  elements.savedDetails.hidden = false;
  elements.savedContextDeleteButton.disabled = false;
  elements.savedDetailsTitle.textContent = item.label || "Unnamed button";
  elements.savedDetailsFont.textContent = `Font: ${compactFontFamily(item.styles.fontFamily)} · ${item.styles.fontWeight || "400"}`;
  elements.savedDetailsBackground.textContent = `Background: ${item.styles.backgroundColor || "Transparent"}`;
  elements.savedDetailsBorder.textContent = `Border: ${formatBorder(item.styles)}`;
  elements.savedDetailsShadow.textContent = `Shadow: ${item.styles.boxShadow || "None"}`;
  elements.savedDetailsCss.innerHTML = highlightCssSnippet(buildCssSnippet(item));
  renderPalette(elements.savedDetailsPalette, item.palette || []);
}

function renderPreviewSurface(item, fitToStage = false) {
  if (item.previewHtml) {
    elements.inspectorPreview.innerHTML = item.previewHtml;
    const root = elements.inspectorPreview.firstElementChild;
    if (root && fitToStage) {
      preparePreviewNode(root);
      fitPreviewToStage(elements.inspectorPreview, root, item);
    }
    return;
  }

  const fallback = document.createElement("button");
  fallback.type = "button";
  fallback.textContent = item.label || "Button";
  applyPreviewStyle(fallback, item.styles, item.width, item.height);
  elements.inspectorPreview.replaceChildren(fallback);
  if (fitToStage) {
    preparePreviewNode(fallback);
    fitPreviewToStage(elements.inspectorPreview, fallback, item);
  }
}

function renderSavedButtonSurface(container, item, fitToStage = false) {
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

function preparePreviewNode(root) {
  root.style.maxWidth = "none";
  root.style.minWidth = "0";
  root.style.boxSizing = "border-box";
  root.style.margin = "0";
  root.style.flexShrink = "0";
}

function fitPreviewToStage(container, root, item) {
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

function moveSaved(direction) {
  if (state.savedButtons.length <= 1) {
    return;
  }

  const currentIndex = state.savedButtons.findIndex((item) => item.id === state.selectedSavedId);
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;
  const lastIndex = state.savedButtons.length - 1;
  const nextIndex = direction > 0
    ? (safeIndex === lastIndex ? 0 : safeIndex + 1)
    : (safeIndex === 0 ? lastIndex : safeIndex - 1);

  hideSavedContextMenu();
  state.selectedSavedId = state.savedButtons[nextIndex].id;
  renderSavedLibrary();
}

function handleSavedPreviewClick() {
  hideSavedContextMenu();
}

function handleSavedPreviewKeyDown(event) {
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    moveSaved(-1);
    return;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    moveSaved(1);
    return;
  }

  if (event.key === "ContextMenu") {
    event.preventDefault();
    showSavedContextMenu(window.innerWidth / 2, window.innerHeight / 2, state.selectedSavedId);
  }
}

function handleSavedPreviewContextMenu(event) {
  if (!state.selectedSavedId) {
    return;
  }

  event.preventDefault();
  elements.savedPreview.blur();
  showSavedContextMenu(event.clientX, event.clientY, state.selectedSavedId);
}

function moveDetected(direction) {
  if (state.detectedButtons.length <= 1) {
    return;
  }

  const lastIndex = state.detectedButtons.length - 1;
  if (direction > 0) {
    state.detectedIndex = state.detectedIndex === lastIndex ? 0 : state.detectedIndex + 1;
  } else {
    state.detectedIndex = state.detectedIndex === 0 ? lastIndex : state.detectedIndex - 1;
  }

  renderCaptureInspector();
}

async function handleScanPage() {
  try {
    setStatus("Scanning visible buttons on the current page...", "Scanning");
    elements.scanPageButton.disabled = true;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || typeof tab.id !== "number") {
      throw new Error("No active tab available.");
    }

    const injection = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scanCurrentPageButtons,
    });

    const result = injection[0] && injection[0].result ? injection[0].result : null;
    if (!result) {
      throw new Error("No scan result returned.");
    }

    state.pageTitle = result.pageTitle || "Untitled page";
    state.pageUrl = formatDomainLabel(result.pageUrl);
    state.detectedButtons = result.buttons.map(normalizeButtonRecord);
    state.detectedIndex = 0;

    const count = state.detectedButtons.length;
    const message =
      count === 0
        ? "Scan complete. No visible button-like components were detected."
        : `Scan complete. ${count} button reference${count === 1 ? "" : "s"} captured.`;

    setStatus(message, "Ready");
    renderAll();
    showToast(count === 0 ? "Scan complete." : `${count} buttons captured.`);
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Scan failed.", "Error");
    showToast("Scan failed.");
  } finally {
    elements.scanPageButton.disabled = false;
  }
}

async function handleSaveCurrent() {
  const current = state.detectedButtons[state.detectedIndex];
  if (!current) {
    setStatus("There is nothing to save yet.", "Error");
    return;
  }

  await saveDetectedItems([current]);
}

async function handleSaveAll() {
  if (state.detectedButtons.length === 0) {
    setStatus("There is nothing to save yet.", "Error");
    return;
  }

  await saveDetectedItems(state.detectedButtons);
}

async function saveDetectedItems(items) {
  const existingIds = new Set(state.savedButtons.map((item) => item.id));
  const freshItems = items.filter((item) => !existingIds.has(item.id));

  if (freshItems.length === 0) {
    setStatus("Those buttons are already stored in your archive.", "Error");
    showToast("Already saved.");
    return;
  }

  state.savedButtons = [...freshItems, ...state.savedButtons];
  state.selectedSavedId = freshItems[0].id;
  await persistSavedButtons();
  renderAll();
  setStatus(`Saved ${freshItems.length} button reference${freshItems.length === 1 ? "" : "s"}.`, "Ready");
  showToast(freshItems.length === 1 ? "Button saved." : `${freshItems.length} buttons saved.`);
}

async function handleRemoveSelectedSaved() {
  if (!state.selectedSavedId) {
    return;
  }

  await removeSavedItem(state.selectedSavedId);
}

async function handleCopySavedCss() {
  const item = state.savedButtons.find((entry) => entry.id === state.selectedSavedId);
  if (!item) {
    return;
  }

  await copyText(buildCssSnippet(item), "CSS copied.");
}

async function handleContextDelete() {
  if (!state.contextMenuId) {
    return;
  }

  const targetId = state.contextMenuId;
  hideSavedContextMenu();
  await removeSavedItem(targetId);
}

function showSavedContextMenu(clientX, clientY, id) {
  state.contextMenuId = id;
  const menu = elements.savedContextMenu;
  menu.hidden = false;
  menu.style.left = `${Math.max(12, Math.min(clientX - 100, window.innerWidth - 148))}px`;
  menu.style.top = `${Math.max(12, Math.min(clientY - 8, window.innerHeight - 56))}px`;
}

function hideSavedContextMenu() {
  state.contextMenuId = null;
  elements.savedContextMenu.hidden = true;
}

function handleGlobalPointerDown(event) {
  if (elements.savedContextMenu.hidden) {
    return;
  }

  if (!elements.savedContextMenu.contains(event.target)) {
    hideSavedContextMenu();
  }
}

function handleGlobalContextMenu(event) {
  if (!event.target.closest("#savedPreview") && !event.target.closest(".saved-button")) {
    hideSavedContextMenu();
  }
}

function handleGlobalKeyDown(event) {
  if (event.key === "Escape") {
    hideSavedContextMenu();
  }
}

async function removeSavedItem(id) {
  const target = state.savedButtons.find((item) => item.id === id);
  state.savedButtons = state.savedButtons.filter((item) => item.id !== id);
  state.selectedSavedId = state.savedButtons[0]?.id || null;
  await persistSavedButtons();
  renderAll();
  setStatus(`Removed "${target?.label || "button"}" from your archive.`, "Ready");
  showToast("Saved button removed.");
}

async function handleClearLibrary() {
  if (state.savedButtons.length === 0) {
    setStatus("The archive is already empty.", "Error");
    return;
  }

  state.savedButtons = [];
  state.selectedSavedId = null;
  await persistSavedButtons();
  renderAll();
  setStatus("Archive cleared.", "Ready");
  showToast("Archive cleared.");
}

async function handleCopyMarkup() {
  const value = elements.inspectorMarkup.textContent || "";
  if (!value) {
    return;
  }

  await copyText(value, "Markup copied.");
}

function applyPreviewStyle(node, styles, width = 0, height = 0) {
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

function renderPalette(container, palette) {
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
      await copyText(hexValue, `${hexValue} copied.`);
    });
    container.appendChild(swatch);
  });
}

async function copyText(value, successMessage) {
  try {
    await navigator.clipboard.writeText(value);
    setStatus(successMessage, "Ready");
    showToast(successMessage);
  } catch (error) {
    console.error(error);
    setStatus("Copy failed.", "Error");
    showToast("Copy failed.");
  }
}

function colorToHex(colorValue) {
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

function normalizeButtonRecord(item) {
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

function buildStableId(item) {
  return [
    item.pageUrl || "",
    item.selector || "",
    item.label || "",
    Math.round(item.width || 0),
    Math.round(item.height || 0),
  ].join("|");
}

function formatDomainLabel(pageUrl) {
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

function highlightCssSnippet(source) {
  let html = escapeHtml(source);

  html = html.replace(/(\.[a-z0-9-]+)(\s*\{)/gi, '<span class="token token-selector">$1</span>$2');
  html = html.replace(/(^|\n)(\s*)([a-z-]+)(:\s*)([^;]+)(;)/g, (_match, lineStart, indent, property, colon, value, semicolon) => {
    return `${lineStart}${indent}<span class="token token-property">${property}</span>${colon}<span class="token token-value">${value}</span><span class="token token-punctuation">${semicolon}</span>`;
  });
  html = html.replace(/[{}]/g, '<span class="token token-punctuation">$&</span>');

  return html;
}

function highlightHtmlSnippet(source) {
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

  const highlightedAttrs = attrSource
    ? ` ${highlightHtmlAttributes(attrSource)}`
    : "";

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

function buildCssSnippet(item) {
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

  const body = rules.map(([property, value]) => `  ${property}: ${value};`).join("\n");
  return `${selectorName} {\n${body}\n}`;
}

function normalizeFontFamily(fontFamily) {
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

  const families = String(fontFamily || "Arial, sans-serif")
    .split(",")
    .map((part) => part.trim().replace(/^[;\s"']+/, "").replace(/[;\s"']+$/, ""))
    .filter(Boolean)
    .filter((part) => !/\bfallback\b/i.test(part));

  const uniqueFamilies = [];
  const seen = new Set();

  families.forEach((part) => {
    const normalized = part.toLowerCase();
    if (seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    uniqueFamilies.push(part);
  });

  return uniqueFamilies
    .map((part) => (genericFamilies.has(part.toLowerCase()) || /^[a-z-]+$/i.test(part) ? part : `"${part}"`))
    .join(", ");
}

function toKebabCase(value) {
  return String(value || "button")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "button";
}

function compactFontFamily(fontFamily) {
  const normalized = normalizeFontFamily(fontFamily);
  return normalized.split(",")[0]?.replace(/^[\s"']+/, "").replace(/[\s"']+$/, "").trim() || "Unknown font";
}

function formatBorder(styles) {
  return `${styles.borderWidth || "0px"} ${styles.borderStyle || "solid"} ${styles.borderColor || "transparent"}`;
}

function isVisibleColor(value) {
  return typeof value === "string" && value.trim() !== "" && value !== "rgba(0, 0, 0, 0)" && value !== "transparent";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function scanCurrentPageButtons() {
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

  function getButtonLabel(node, index) {
    const rawLabel =
      node.innerText ||
      node.textContent ||
      node.value ||
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

  function isLowValueButton(node, label, rect, computedStyle) {
    const normalized = normalizeButtonLabel(label);
    const hasGraphic = Boolean(node.querySelector("svg, img"));
    const looksTiny = rect.width <= 60 && rect.height <= 60;
    const looksUtilitySized = rect.width <= 88 && rect.height <= 72;
    const textLength = normalized.replace(/[^a-z0-9]/gi, "").length;
    const symbolOnly = normalized.length <= 1 && !/[a-z0-9]/i.test(normalized);
    const hasChrome = hasVisualChrome(computedStyle);
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
      "x",
    ].includes(normalized);

    if (rect.width < 20 || rect.height < 20) return true;
    if (isAriaHidden(node)) return true;
    if (!normalized && !hasGraphic) return true;
    if (symbolOnly && looksTiny) return true;
    if (disposable && looksUtilitySized) return true;
    if (textLength <= 2 && looksTiny && !hasGraphic) return true;
    if (hasGraphic && textLength <= 3 && !hasChrome) return true;
    if (!hasChrome && textLength <= 2) return true;
    if (node.disabled && looksUtilitySized) return true;
    if (node.getAttribute("role") === "button" && !hasChrome && textLength <= 8) return true;
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
      const label = getButtonLabel(node, 0);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        computedStyle.visibility !== "hidden" &&
        computedStyle.display !== "none" &&
        computedStyle.opacity !== "0" &&
        !isLowValueButton(node, label, rect, computedStyle)
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
      const normalizedLabel = normalizeButtonLabel(label);

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
            minWidth: computedStyle.minWidth !== '0px' ? computedStyle.minWidth : `${measuredWidth}px`,
            minHeight: computedStyle.minHeight !== '0px' ? computedStyle.minHeight : `${measuredHeight}px`,
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
