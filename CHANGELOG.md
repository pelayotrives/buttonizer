# Changelog

All notable changes to Buttonizer are documented in this file.

## [0.0.2]

### Changed

- Archive button previews now show a pointer cursor to indicate that they open the captured source page.
- Better markup validation.
- Change icons.
- Bumped the extension version to `0.0.2`.

## [0.0.1]

### Added

- First working MV3 popup for scanning the active tab and keeping a private local archive.
- Detection of native buttons, submit/reset controls, role buttons, and visually styled links that behave like buttons.
- Shadow DOM traversal and stylesheet inspection, including discovered font-face rules and computed visual styles.
- Filtering and deduplication of hidden, nested, utility, icon-only, and repeated candidates.
- Current Button carousel with visual preview, typography, dimensions, colors, borders, radius, shadow, selector, palette, and markup inspection.
- Archive carousel for saved buttons with persistent storage through `chrome.storage.local`.
- Context-menu deletion for saved buttons and compact CSS and markup copy actions.
- Click-to-copy palette colors with HEX conversion and toast feedback for key actions.
- JSON archive export with individual HTML, formatted CSS, source metadata, dimensions, and color palette for every saved button.
- Scan loading overlay with blur, spinner, and a minimum 2.5 second presentation duration.
- Two-line title truncation in Current Button and Archive to prevent long labels from breaking the layout.
- Compact code-style Buttonizer branding using the extension mark from `icons/icon-32.png`.
- Clean white popup layout with compact controls, section dividers, bounded previews, responsive overflow handling, and accessible labels.
- VS Code-style syntax highlighting for captured HTML and generated CSS.
- Manual linear parsers for CSS declarations, HTML attributes, font-family normalization, and kebab-case selectors to avoid expensive regex backtracking.

### Changed

- Scan execution now injects the scanner file and communicates through runtime messages, with retry support when the active tab has no listener yet.
- Preview rendering sanitizes captured markup, removes executable or external content, applies captured styles, loads captured fonts, and scales large controls to the available stage.
- Archive controls use `Export` and `Clear` labels, with export disabled when no saved buttons exist.
- Archive previews now open the exact page URL where the button was captured.
- Captured markup is normalized before inspection so excessive whitespace does not obscure the source.
- Archive deletion uses the visible `Remove` action instead of a separate context menu.
- Popup and manifest remain on version `0.0.1` for the first Chrome Web Store release.

### Fixed

- Corrected font-family cleanup for malformed leading semicolons and fallback-family quoting.
- Prevented HTML highlighting from breaking on quoted attribute values containing `>`.
- Prevented long labels, saved previews, and code blocks from overflowing the popup.
- Removed nested helper declarations flagged by SonarQube and reduced utility parsing cognitive complexity.
