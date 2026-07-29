const storage_key = "buttonizer_saved_buttons";

const refs = {
  scanButton: document.getElementById("scanButton"),
  saveAllButton: document.getElementById("saveAllButton"),
  clearLibraryButton: document.getElementById("clearLibraryButton"),
  statusMessage: document.getElementById("statusMessage"),
  pageMeta: document.getElementById("pageMeta"),
  detectedCount: document.getElementById("detectedCount"),
  detectedList: document.getElementById("detectedList"),
  savedList: document.getElementById("savedList")
};

let detectedButtons = [];
let savedButtons = [];
let lastPage = null;

void initializeApp();

async function initializeApp() {
  wireEvents();
  await loadSavedButtons();
  renderDetectedButtons();
  renderSavedButtons();
}

function wireEvents() {
  refs.scanButton.addEventListener("click", () => {
    void scanCurrentPage();
  });

  refs.saveAllButton.addEventListener("click", () => {
    void saveAllDetectedButtons();
  });

  refs.clearLibraryButton.addEventListener("click", async () => {
    savedButtons = [];
    await chrome.storage.local.set({ [storage_key]: savedButtons });
    renderSavedButtons();
    showStatus("Saved library cleared.");
  });
}

async function scanCurrentPage() {
  try {
    showStatus("");
    refs.scanButton.disabled = true;
    refs.scanButton.textContent = "Scanning...";

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error("No active tab found.");
    }

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeButtonsFromPage
    });

    detectedButtons = result?.buttons ?? [];
    lastPage = result?.page ?? null;

    refs.pageMeta.textContent = lastPage
      ? `${lastPage.title} · ${lastPage.hostname}`
      : "No page context available.";

    renderDetectedButtons();

    if (!detectedButtons.length) {
      showStatus("No visible buttons were detected on this page.", true);
      return;
    }

    showStatus(`${detectedButtons.length} button${detectedButtons.length === 1 ? "" : "s"} detected.`);
  } catch (error) {
    console.error(error);
    detectedButtons = [];
    renderDetectedButtons();
    refs.pageMeta.textContent = "Scan unavailable for this page.";
    showStatus(error instanceof Error ? error.message : "Could not scan the current page.", true);
  } finally {
    refs.scanButton.disabled = false;
    refs.scanButton.textContent = "Scan current page";
  }
}

async function loadSavedButtons() {
  const data = await chrome.storage.local.get(storage_key);
  savedButtons = Array.isArray(data?.[storage_key]) ? data[storage_key] : [];
}

async function saveButtonRecord(buttonRecord) {
  const existingIndex = savedButtons.findIndex((item) => item.id === buttonRecord.id);
  const enriched = {
    ...buttonRecord,
    savedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    savedButtons[existingIndex] = enriched;
  } else {
    savedButtons.unshift(enriched);
  }

  await chrome.storage.local.set({ [storage_key]: savedButtons });
  renderSavedButtons();
}

async function saveAllDetectedButtons() {
  for (const button of detectedButtons) {
    await saveButtonRecord(button);
  }

  showStatus(`${detectedButtons.length} button${detectedButtons.length === 1 ? "" : "s"} saved to your library.`);
}

async function removeSavedButton(id) {
  savedButtons = savedButtons.filter((item) => item.id !== id);
  await chrome.storage.local.set({ [storage_key]: savedButtons });
  renderSavedButtons();
}

function renderDetectedButtons() {
  refs.detectedCount.textContent = String(detectedButtons.length);
  refs.saveAllButton.classList.toggle("hidden", detectedButtons.length <= 1);

  if (!detectedButtons.length) {
    refs.detectedList.className = "card-list empty-state";
    refs.detectedList.textContent = "Scan a page to inspect its buttons.";
    return;
  }

  refs.detectedList.className = "card-list";
  refs.detectedList.innerHTML = "";

  for (const button of detectedButtons) {
    const card = buildButtonCard(button, {
      actionLabel: isAlreadySaved(button.id) ? "Update saved" : "Save to library",
      onAction: async () => {
        await saveButtonRecord(button);
        renderDetectedButtons();
        showStatus(`Saved \"${button.name}\" to your library.`);
      }
    });

    refs.detectedList.append(card);
  }
}

function renderSavedButtons() {
  refs.clearLibraryButton.classList.toggle("hidden", !savedButtons.length);

  if (!savedButtons.length) {
    refs.savedList.className = "card-list empty-state";
    refs.savedList.textContent = "No saved buttons yet.";
    return;
  }

  refs.savedList.className = "card-list";
  refs.savedList.innerHTML = "";

  for (const button of savedButtons) {
    const card = buildButtonCard(button, {
      actionLabel: "Remove",
      onAction: async () => {
        await removeSavedButton(button.id);
        showStatus(`Removed \"${button.name}\" from your library.`);
      },
      secondaryText: button.savedAt ? `Saved ${formatTimestamp(button.savedAt)}` : "Saved locally"
    });

    refs.savedList.append(card);
  }
}

function buildButtonCard(button, { actionLabel, onAction, secondaryText = null }) {
  const card = document.createElement("article");
  card.className = "button-card";

  const previewButton = document.createElement("button");
  previewButton.type = "button";
  previewButton.className = "button-preview";
  previewButton.textContent = button.previewLabel;
  previewButton.disabled = true;
  applyPreviewStyles(previewButton, button.styles);

  const previewWrap = document.createElement("div");
  previewWrap.className = "preview-wrap";
  previewWrap.append(previewButton);

  const metaRow = document.createElement("div");
  metaRow.className = "meta-row";
  metaRow.innerHTML = `
    <span class="meta-pill">${escapeHtml(button.tagName)}</span>
    <span class="meta-pill">${escapeHtml(button.page.hostname)}</span>
    <span class="meta-pill">${escapeHtml(button.size.width)} x ${escapeHtml(button.size.height)}</span>
  `;

  const styles = document.createElement("div");
  styles.className = "style-list";
  styles.innerHTML = `
    <span><strong>Font:</strong> ${escapeHtml(button.styles.fontFamily)} · ${escapeHtml(button.styles.fontSize)} / ${escapeHtml(button.styles.fontWeight)}</span>
    <span><strong>Background:</strong> ${escapeHtml(button.styles.backgroundColor)}</span>
    <span><strong>Text:</strong> ${escapeHtml(button.styles.color)}</span>
    <span><strong>Radius:</strong> ${escapeHtml(button.styles.borderRadius)} · <strong>Shadow:</strong> ${escapeHtml(button.styles.boxShadow)}</span>
  `;

  const palette = document.createElement("div");
  palette.className = "palette-row";
  for (const color of button.palette) {
    const item = document.createElement("span");
    item.className = "color-chip";
    item.innerHTML = `<span class="color-swatch" style="color:${escapeHtml(color)}"></span>${escapeHtml(color)}`;
    palette.append(item);
  }

  const selector = document.createElement("p");
  selector.className = "selector";
  selector.innerHTML = `<strong>Selector:</strong> ${escapeHtml(button.selector)}`;

  const code = document.createElement("pre");
  code.className = "code-snippet";
  code.textContent = button.htmlSnippet;

  const actions = document.createElement("div");
  actions.className = "card-actions";

  if (secondaryText) {
    const meta = document.createElement("span");
    meta.className = "meta-pill";
    meta.textContent = secondaryText;
    actions.append(meta);
  }

  const actionButton = document.createElement("button");
  actionButton.type = "button";
  actionButton.className = "card-btn";
  actionButton.textContent = actionLabel;
  actionButton.addEventListener("click", () => {
    void onAction();
  });
  actions.append(actionButton);

  card.append(previewWrap, metaRow, styles, palette, selector, code, actions);
  return card;
}

function applyPreviewStyles(element, styles) {
  element.style.background = styles.backgroundColor;
  element.style.color = styles.color;
  element.style.borderColor = styles.borderColor;
  element.style.borderStyle = styles.borderStyle;
  element.style.borderWidth = styles.borderWidth;
  element.style.borderRadius = styles.borderRadius;
  element.style.boxShadow = styles.boxShadow;
  element.style.fontFamily = styles.fontFamily;
  element.style.fontSize = styles.fontSize;
  element.style.fontWeight = styles.fontWeight;
  element.style.padding = styles.padding;
  element.style.letterSpacing = styles.letterSpacing;
  element.style.textTransform = styles.textTransform;
  element.style.minWidth = "fit-content";
  element.style.opacity = "1";
  element.style.cursor = "default";
}

function isAlreadySaved(id) {
  return savedButtons.some((item) => item.id === id);
}

function showStatus(message, isError = false) {
  refs.statusMessage.textContent = message;
  refs.statusMessage.classList.toggle("visible", Boolean(message));
  refs.statusMessage.classList.toggle("error", isError);
}

function formatTimestamp(value) {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function scrapeButtonsFromPage() {
  const candidates = Array.from(document.querySelectorAll("button, input[type='button'], input[type='submit'], [role='button']"));

  const buttons = candidates
    .map((element, index) => serializeButton(element, index))
    .filter(Boolean)
    .slice(0, 75);

  return {
    page: {
      title: document.title || location.hostname,
      url: location.href,
      hostname: location.hostname
    },
    buttons
  };

  function serializeButton(element, index) {
    const computed = getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    if (computed.display === "none" || computed.visibility === "hidden" || rect.width < 1 || rect.height < 1) {
      return null;
    }

    const previewLabel = (
      element.innerText ||
      element.getAttribute("aria-label") ||
      element.getAttribute("title") ||
      element.value ||
      element.textContent ||
      "Button"
    ).replace(/\s+/g, " ").trim().slice(0, 80) || "Button";

    const selector = buildSelector(element);
    const palette = uniqueColors([
      computed.backgroundColor,
      computed.color,
      computed.borderColor,
      ...extractShadowColors(computed.boxShadow)
    ]);

    return {
      id: `${location.href}::${selector}::${index}`,
      name: previewLabel,
      previewLabel,
      tagName: element.tagName.toLowerCase(),
      selector,
      htmlSnippet: element.outerHTML.slice(0, 600),
      page: {
        title: document.title || location.hostname,
        url: location.href,
        hostname: location.hostname
      },
      size: {
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      },
      styles: {
        fontFamily: computed.fontFamily,
        fontSize: computed.fontSize,
        fontWeight: computed.fontWeight,
        color: computed.color,
        backgroundColor: computed.backgroundColor,
        borderColor: computed.borderColor,
        borderWidth: computed.borderWidth,
        borderStyle: computed.borderStyle,
        borderRadius: computed.borderRadius,
        boxShadow: computed.boxShadow,
        padding: `${computed.paddingTop} ${computed.paddingRight} ${computed.paddingBottom} ${computed.paddingLeft}`,
        letterSpacing: computed.letterSpacing,
        textTransform: computed.textTransform
      },
      palette
    };
  }

  function buildSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }

    const parts = [];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 4) {
      let part = current.tagName.toLowerCase();
      if (current.classList.length) {
        part += `.${Array.from(current.classList).slice(0, 2).join(".")}`;
      }
      const siblings = current.parentElement ? Array.from(current.parentElement.children).filter((child) => child.tagName === current.tagName) : [];
      if (siblings.length > 1) {
        part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
      parts.unshift(part);
      current = current.parentElement;
    }

    return parts.join(" > ");
  }

  function uniqueColors(values) {
    return [...new Set(values.filter((value) => isUsefulColor(value)))].slice(0, 5);
  }

  function isUsefulColor(value) {
    return Boolean(value) && value !== "rgba(0, 0, 0, 0)" && value !== "transparent";
  }

  function extractShadowColors(boxShadow) {
    if (!boxShadow || boxShadow === "none") return [];
    return boxShadow.match(/rgba?\([^\)]+\)/g) || [];
  }
}
