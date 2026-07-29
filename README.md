# Buttonizer

Buttonizer is a Chrome extension for building a private library of button references from real websites.

## What it does

- Scan the current page for visible button-like components
- Preview captured buttons directly inside the popup
- Inspect key styles such as font, background color, text color, radius, border, and shadow
- Save interesting buttons to a local personal library
- Revisit and compare saved button snapshots anytime

## Why it exists

Design references are often scattered across tabs, screenshots, bookmarks, and memory. Buttonizer makes that process faster by turning live buttons into a structured local swipe file you can inspect from one place.

## Privacy

Buttonizer is local-first.

- No account required
- No analytics
- No remote sync
- No external API calls
- No user data sold or shared

The extension stores saved button snapshots locally in your browser using `chrome.storage.local`.

Read the full privacy policy here:

- [Privacy policy](https://pelayotrives.github.io/buttonizer/privacy/)

## Permissions used

- `activeTab`: inspect the current tab after you trigger a scan
- `scripting`: collect button data from the active page
- `storage`: store your saved button library locally
