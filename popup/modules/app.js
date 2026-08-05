import { STORAGE_KEY, state, elements } from "./dom.js";
import { renderPreviewSurface, renderSavedButtonSurface } from "./preview.js";
import {
  buildCssSnippet,
  compactFontFamily,
  formatBorder,
  highlightCssSnippet,
  highlightHtmlSnippet,
  normalizeMarkup,
  normalizeButtonRecord,
  renderPalette,
} from "./utils.js";

export function startApp() {
  bootstrap().catch((error) => {
    console.error(error);
    setStatus(error.message || "Buttonizer could not start.", "Error");
    showToast("Buttonizer could not start.");
  });
}

async function bootstrap() {
  bindEvents();
  await loadSavedButtons();
  renderVersion();
  renderAll();
}

function renderVersion() {
  const manifest = chrome.runtime.getManifest();
  elements.appVersion.textContent = "Version " + manifest.version;
}

function bindEvents() {
  elements.scanPageButton.addEventListener("click", handleScanPage);
  elements.saveAllButton.addEventListener("click", handleSaveAll);
  elements.saveCurrentButton.addEventListener("click", handleSaveCurrent);
  elements.clearLibraryButton.addEventListener("click", handleClearLibrary);
  elements.exportArchiveButton.addEventListener("click", handleExportArchive);
  elements.capturePrevButton.addEventListener("click", () => moveDetected(-1));
  elements.captureNextButton.addEventListener("click", () => moveDetected(1));
  elements.archivePrevButton.addEventListener("click", () => moveSaved(-1));
  elements.archiveNextButton.addEventListener("click", () => moveSaved(1));
  elements.savedPreview.addEventListener("click", handleSavedPreviewClick);
  elements.savedPreview.addEventListener("keydown", handleSavedPreviewKeyDown);
  elements.removeSavedButton.addEventListener("click", handleRemoveSelectedSaved);
  elements.copySavedCssButton.addEventListener("click", handleCopySavedCss);
  elements.copyMarkupButton.addEventListener("click", handleCopyMarkup);
}

async function loadSavedButtons() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  state.savedButtons = Array.isArray(result[STORAGE_KEY])
    ? result[STORAGE_KEY].map(normalizeButtonRecord)
    : [];
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

function setScanLoader(visible) {
  elements.scanLoader.hidden = !visible;
  elements.scanLoader.setAttribute("aria-hidden", String(!visible));
}

function waitForScanMinimumDuration(startedAt) {
  const remaining = 2500 - (performance.now() - startedAt);
  if (remaining <= 0) return Promise.resolve();
  return new Promise((resolve) => window.setTimeout(resolve, remaining));
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
  elements.exportArchiveButton.disabled = state.savedButtons.length === 0;
}

function renderPageFacts() {
  const facts = [
    { label: "Title", value: state.pageTitle },
    { label: "Domain", value: state.pageUrl },
  ];

  elements.pageFacts.replaceChildren(...facts.map(createFactCard));
}

function createFactCard(fact) {
  const card = document.createElement("div");
  card.className = "fact-card";

  const label = document.createElement("span");
  label.className = "fact-card__label";
  label.textContent = fact.label;

  const value = document.createElement("p");
  value.className = "fact-card__value";
  value.textContent = fact.value;

  card.append(label, value);
  return card;
}

function renderHighlightedContent(container, source) {
  const parsed = new DOMParser().parseFromString(source, "text/html");
  const nodes = Array.from(parsed.body.childNodes).map((node) => document.importNode(node, true));
  container.replaceChildren(...nodes);
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

  renderInspector(state.detectedButtons[state.detectedIndex]);
}

function renderInspector(item) {
  elements.inspectorTitle.textContent = item.label || "Unnamed button";
  elements.inspectorSubtitle.textContent = `${item.pageTitle || "Unknown page"} · ${item.hostname || "Local page"}`;
  renderPreviewSurface(elements.inspectorPreview, item, true);

  elements.inspectorSize.textContent = `${item.width}px × ${item.height}px`;
  elements.inspectorFont.textContent = compactFontFamily(item.styles.fontFamily);
  elements.inspectorWeight.textContent = item.styles.fontWeight || "400";
  elements.inspectorBackground.textContent = item.styles.backgroundColor || "Transparent";
  elements.inspectorText.textContent = item.styles.color || "Inherited";
  elements.inspectorBorder.textContent = formatBorder(item.styles);
  elements.inspectorRadius.textContent = item.styles.borderRadius || "0px";
  elements.inspectorShadow.textContent = item.styles.boxShadow || "None";
  elements.inspectorSelector.textContent = item.selector || "No selector available";
  renderHighlightedContent(elements.inspectorMarkup, highlightHtmlSnippet(normalizeMarkup(item.outerHtml || "<button></button>")));
  renderPalette(elements.inspectorPalette, item.palette || [], handlePaletteCopy);
}

function renderSavedLibrary() {
  elements.savedEmpty.hidden = state.savedButtons.length > 0;
  elements.savedLibrary.hidden = state.savedButtons.length === 0;
  elements.savedDetails.hidden = state.savedButtons.length === 0;
  elements.copySavedCssButton.disabled = state.savedButtons.length === 0;
  elements.archivePrevButton.disabled = state.savedButtons.length <= 1;
  elements.archiveNextButton.disabled = state.savedButtons.length <= 1;

  if (state.savedButtons.length === 0) {
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
  elements.savedDetailsTitle.textContent = item.label || "Unnamed button";
  elements.savedDetailsFont.textContent = `Font: ${compactFontFamily(item.styles.fontFamily)} · ${item.styles.fontWeight || "400"}`;
  elements.savedDetailsBackground.textContent = `Background: ${item.styles.backgroundColor || "Transparent"}`;
  elements.savedDetailsBorder.textContent = `Border: ${formatBorder(item.styles)}`;
  elements.savedDetailsShadow.textContent = `Shadow: ${item.styles.boxShadow || "None"}`;
  renderHighlightedContent(elements.savedDetailsCss, highlightCssSnippet(buildCssSnippet(item)));
  renderPalette(elements.savedDetailsPalette, item.palette || [], handlePaletteCopy);
}

function moveSaved(direction) {
  if (state.savedButtons.length <= 1) {
    return;
  }

  const currentIndex = state.savedButtons.findIndex((item) => item.id === state.selectedSavedId);
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;
  const lastIndex = state.savedButtons.length - 1;
  const nextIndex = getCircularSavedIndex(safeIndex, lastIndex, direction);

  state.selectedSavedId = state.savedButtons[nextIndex].id;
  renderSavedLibrary();
}

function getCircularSavedIndex(currentIndex, lastIndex, direction) {
  if (direction > 0) {
    if (currentIndex === lastIndex) {
      return 0;
    }
    return currentIndex + 1;
  }

  if (currentIndex === 0) {
    return lastIndex;
  }
  return currentIndex - 1;
}

async function handleSavedPreviewClick() {
  const item = state.savedButtons.find((entry) => entry.id === state.selectedSavedId);
  if (!item?.pageUrl) {
    setStatus("This saved button has no source URL.", "Error");
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error("No active tab available.");
    }
    await chrome.tabs.update(tab.id, { url: item.pageUrl });
  } catch (error) {
    setStatus(error.message || "Could not open the source page.", "Error");
  }
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

function getScanStatusMessage(count) {
  if (count === 0) {
    return "Scan complete. No visible button-like components were detected.";
  }
  const noun = count === 1 ? "button" : "buttons";
  return `Scan complete. ${count} ${noun} captured.`;
}

function getScanToastMessage(count) {
  if (count === 0) {
    return "Scan complete.";
  }
  return `${count} buttons captured.`;
}

async function handleScanPage() {
  try {
    setStatus("Scanning visible buttons on the current page...", "Scanning");
    elements.scanPageButton.disabled = true;
    const scanStartedAt = performance.now();
    setScanLoader(true);

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || typeof tab.id !== "number") {
      throw new Error("No active tab available.");
    }

    let result;
    try {
      result = await chrome.tabs.sendMessage(tab.id, { type: "buttonizer:scan" });
    } catch {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["popup/modules/scan.js"],
      });
      result = await chrome.tabs.sendMessage(tab.id, { type: "buttonizer:scan" });
    }
    if (!result) {
      throw new Error("No scan result returned.");
    }

    await waitForScanMinimumDuration(scanStartedAt);

    state.pageTitle = result.pageTitle || "Untitled page";
    state.pageUrl = result.pageUrl || "Unknown page";
    state.detectedButtons = result.buttons.map(normalizeButtonRecord);
    state.detectedIndex = 0;

    const count = state.detectedButtons.length;
    const message = getScanStatusMessage(count);

    setStatus(message, "Ready");
    renderAll();
    showToast(getScanToastMessage(count));
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Scan failed.", "Error");
    showToast("Scan failed.");
  } finally {
    setScanLoader(false);
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

function createArchiveExport() {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    buttons: state.savedButtons.map((item) => ({
      id: item.id,
      label: item.label,
      html: item.outerHtml,
      css: buildCssSnippet(item),
      source: {
        pageTitle: item.pageTitle,
        pageUrl: item.pageUrl,
        hostname: item.hostname,
        selector: item.selector,
      },
      dimensions: { width: item.width, height: item.height },
      palette: item.palette,
    })),
  };
}

function downloadArchiveJson(payload) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "buttonizer_archive_" + timestamp + ".json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function handleExportArchive() {
  if (state.savedButtons.length === 0) {
    setStatus("The archive is empty.", "Error");
    showToast("Nothing to export.");
    return;
  }

  downloadArchiveJson(createArchiveExport());
  setStatus("Archive exported.", "Ready");
  showToast("Archive exported.");
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

async function handlePaletteCopy(hexValue) {
  await copyText(hexValue, `${hexValue} copied.`);
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
