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
};

const elements = {
  scanPageButton: document.getElementById("scanPageButton"),
  saveAllButton: document.getElementById("saveAllButton"),
  saveCurrentButton: document.getElementById("saveCurrentButton"),
  clearLibraryButton: document.getElementById("clearLibraryButton"),
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
  elements.removeSavedButton.addEventListener("click", handleRemoveSelectedSaved);
  elements.copySavedCssButton.addEventListener("click", handleCopySavedCss);
  elements.copyMarkupButton.addEventListener("click", handleCopyMarkup);
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
  elements.inspectorPreview.textContent = item.label || "Button";
  applyPreviewStyle(elements.inspectorPreview, item.styles);

  elements.inspectorSize.textContent = `${item.width}px × ${item.height}px`;
  elements.inspectorFont.textContent = compactFontFamily(item.styles.fontFamily);
  elements.inspectorWeight.textContent = item.styles.fontWeight || "400";
  elements.inspectorBackground.textContent = item.styles.backgroundColor || "Transparent";
  elements.inspectorText.textContent = item.styles.color || "Inherited";
  elements.inspectorBorder.textContent = formatBorder(item.styles);
  elements.inspectorRadius.textContent = item.styles.borderRadius || "0px";
  elements.inspectorShadow.textContent = item.styles.boxShadow || "None";
  elements.inspectorSelector.textContent = item.selector || "No selector available";
  elements.inspectorMarkup.textContent = item.outerHtml || "<button></button>";

  renderPalette(elements.inspectorPalette, item.palette || []);
}

function renderSavedLibrary() {
  elements.savedLibrary.innerHTML = "";
  elements.savedEmpty.hidden = state.savedButtons.length > 0;
  elements.savedLibrary.hidden = state.savedButtons.length === 0;
  elements.savedDetails.hidden = state.savedButtons.length === 0;
  elements.copySavedCssButton.disabled = state.savedButtons.length === 0;

  if (state.savedButtons.length === 0) {
    state.selectedSavedId = null;
    return;
  }

  if (!state.savedButtons.some((item) => item.id === state.selectedSavedId)) {
    state.selectedSavedId = state.savedButtons[0].id;
  }

  const fragment = document.createDocumentFragment();

  state.savedButtons.forEach((item) => {
    const wrapper = document.createElement("div");
    wrapper.className = "saved-button-wrap";

    const previewButton = document.createElement("button");
    previewButton.className = "saved-button";
    if (item.id === state.selectedSavedId) {
      previewButton.classList.add("is-active");
    }
    previewButton.type = "button";
    previewButton.textContent = item.label || "Button";
    applyPreviewStyle(previewButton, item.styles);
    previewButton.addEventListener("click", () => {
      state.selectedSavedId = item.id;
      renderSavedLibrary();
    });

    const removeButton = document.createElement("button");
    removeButton.className = "saved-button__remove";
    removeButton.type = "button";
    removeButton.setAttribute("aria-label", `Remove ${item.label || "button"}`);
    removeButton.textContent = "×";
    removeButton.addEventListener("click", async () => {
      await removeSavedItem(item.id);
    });

    wrapper.append(previewButton, removeButton);
    fragment.appendChild(wrapper);
  });

  elements.savedLibrary.appendChild(fragment);

  const selectedItem = state.savedButtons.find((item) => item.id === state.selectedSavedId) || state.savedButtons[0];
  renderSavedDetails(selectedItem);
}

function renderSavedDetails(item) {
  if (!item) {
    elements.savedDetails.hidden = true;
    return;
  }

  elements.savedDetails.hidden = false;
  elements.savedDetailsTitle.textContent = item.label || "Unnamed button";
  elements.savedDetailsFont.textContent = `Font: ${compactFontFamily(item.styles.fontFamily)} · ${item.styles.fontWeight || "400"}`;
  elements.savedDetailsBackground.textContent = `Background: ${item.styles.backgroundColor || "Transparent"}`;
  elements.savedDetailsBorder.textContent = `Border: ${formatBorder(item.styles)}`;
  elements.savedDetailsShadow.textContent = `Shadow: ${item.styles.boxShadow || "None"}`;
  elements.savedDetailsCss.textContent = buildCssSnippet(item);
  renderPalette(elements.savedDetailsPalette, item.palette || []);
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

function applyPreviewStyle(node, styles) {
  node.style.fontFamily = styles.fontFamily || "Arial, sans-serif";
  node.style.fontSize = styles.fontSize || "14px";
  node.style.fontWeight = styles.fontWeight || "400";
  node.style.color = styles.color || "inherit";
  node.style.background = styles.backgroundColor || "transparent";
  node.style.borderColor = styles.borderColor || "transparent";
  node.style.borderStyle = styles.borderStyle || "solid";
  node.style.borderWidth = styles.borderWidth || "1px";
  node.style.borderRadius = styles.borderRadius || "0px";
  node.style.boxShadow = styles.boxShadow || "none";
  node.style.padding = styles.padding || "10px 16px";
  node.style.letterSpacing = "normal";
  node.style.textTransform = "none";
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
    styles: {
      fontFamily: item.styles?.fontFamily || "Arial, sans-serif",
      fontSize: item.styles?.fontSize || "14px",
      fontWeight: item.styles?.fontWeight || "400",
      color: item.styles?.color || "",
      backgroundColor: item.styles?.backgroundColor || "",
      borderColor: item.styles?.borderColor || "",
      borderWidth: item.styles?.borderWidth || "0px",
      borderStyle: item.styles?.borderStyle || "solid",
      borderRadius: item.styles?.borderRadius || "0px",
      boxShadow: item.styles?.boxShadow || "none",
      padding: item.styles?.padding || "10px 16px",
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
  const value = String(fontFamily || "Arial, sans-serif").trim();
  return /["']/.test(value) ? value : value.replace(/([^,]+)/g, '"$1"').replace(/"\s+/g, '"').replace(/\s+"/g, '"');
}

function toKebabCase(value) {
  return String(value || "button")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "button";
}

function compactFontFamily(fontFamily) {
  return String(fontFamily || "Unknown font").split(",")[0].replace(/["']/g, "").trim();
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
      node.value ||
      node.getAttribute("aria-label") ||
      node.getAttribute("title") ||
      `Button ${index + 1}`;

    return rawLabel.replace(/\s+/g, " ").trim() || `Button ${index + 1}`;
  }

  const candidates = Array.from(
    document.querySelectorAll("button, input[type='button'], input[type='submit'], [role='button']")
  );

  const buttons = candidates
    .filter((node) => {
      const rect = node.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(node);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        computedStyle.visibility !== "hidden" &&
        computedStyle.display !== "none" &&
        computedStyle.opacity !== "0"
      );
    })
    .slice(0, 80)
    .map((node, index) => {
      const rect = node.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(node);
      const backgroundColor = computedStyle.backgroundColor;
      const textColor = computedStyle.color;
      const borderColor = computedStyle.borderColor;
      const shadowColor = extractShadowColor(computedStyle.boxShadow);

      return {
        label: getButtonLabel(node, index),
        pageTitle: document.title || "Untitled page",
        pageUrl: window.location.href,
        hostname: window.location.hostname,
        selector: buildSelector(node),
        outerHtml: node.outerHTML.slice(0, 600),
        width: rect.width,
        height: rect.height,
        palette: [backgroundColor, textColor, borderColor, shadowColor],
        styles: {
          fontFamily: computedStyle.fontFamily,
          fontSize: computedStyle.fontSize,
          fontWeight: computedStyle.fontWeight,
          color: textColor,
          backgroundColor,
          borderColor,
          borderWidth: computedStyle.borderWidth,
          borderStyle: computedStyle.borderStyle,
          borderRadius: computedStyle.borderRadius,
          boxShadow: computedStyle.boxShadow,
          padding: computedStyle.padding,
          letterSpacing: computedStyle.letterSpacing,
          textTransform: computedStyle.textTransform,
        },
      };
    });

  return {
    pageTitle: document.title || "Untitled page",
    pageUrl: window.location.href,
    buttons,
  };
}
