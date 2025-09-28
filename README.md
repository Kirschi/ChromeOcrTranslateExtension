# Chrome OCR Extension

An MV3 Chrome/Edge extension that lets you draw a region on the current page, performs OCR completely online using **Azure AI Vision (Image Analysis / Read)**, then (optionally) sends the recognized text to **Azure Translator**. The recognized or translated text is overlaid inline in a small, movable bubble. Primary focus: Japanese (including vertical manga text) but it works for any language supported by Azure Vision.

## Architecture

```
User Selection (content script) --> Screenshot (service worker) --> Crop (content script)
    --> Azure Vision (Read) OCR --> (Optional) Azure Translator --> Overlay Bubble
```

## Current Implementation (Scaffold)

This repository contains a Manifest V3 Chrome extension scaffold that:

1. Lets you start a region selection (popup button or keyboard shortcut).
2. Captures a screenshot of the current tab and crops it client‑side to the selected rectangle.
3. Sends the cropped PNG bytes directly to Azure AI Vision (Image Analysis / Read feature).
4. Optionally sends the recognized text to Azure Translator (if key + endpoint configured) as a second call.
5. Overlays the (translated or original) text near the selection and stores the last result in sync storage.

## File / Module Structure

```
manifest.json
background/
    service_worker.js         # Handles tab capture, keyboard command, script injection
content/
    selection.js              # Region selection UI, image crop, OCR + translation calls, overlay bubble
    overlay.css               # Styles for selection rectangle & result bubble
popup/
    popup.html/.js/.css       # Popup UI to start selection & show last result
options/
    options.html/.js/.css     # Config: Azure Vision + Translator settings, auto-translate toggle
src/
    messages.js               # Message & storage key constants + defaults
assets/icons/*.png          # Placeholder icons (add real icons later)
README.md
```

## Permissions Rationale

| Permission | Reason |
|------------|--------|
| storage    | Persist user configuration & last result |
| scripting  | Inject content script & CSS on demand for selection |
| tabs       | Required for `chrome.tabs.captureVisibleTab` screenshot |

`host_permissions` are limited to Azure Translator endpoints (Vision endpoint domain is covered by user-entered HTTPS URL; no blanket wildcard required unless you prefer to add it). There is no local processing path.

If you later implement the OCR entirely in-page (e.g. WebAssembly) and drop screenshot capture, you may be able to remove or reduce some permissions.

## Keyboard Shortcut

Default: `Ctrl+Shift+Y` (Win/Linux) / `Command+Shift+Y` (macOS)

You can customize it via `chrome://extensions/shortcuts`.

## Configuration (Options Page)

Open the extension's options or visit the popup and click "Settings". Fields:

Azure AI Vision Section:
* Azure Vision Endpoint (e.g. `https://<resource>.cognitiveservices.azure.com`).
* Azure Vision Key.
* Vision Read Model Version (default `2024-02-29-preview`).

Translation Section:
* Azure Translate Endpoint (full URL with query specifying target language) – default uses `to=en`.
* Azure Translate Key & Region (if required by your Azure resource setup).
* Auto translate toggle – if disabled, only OCR text is displayed.

The last OCR/translation result is stored (shortened) and shown in the popup.

### Theme Support

The extension supports Light, Dark, or System (automatic) theme selection. Choose your preference on the Options page. System mode tracks the browser / OS `prefers-color-scheme` and switches automatically. Themed surfaces include:
* Options page UI
* Popup window
* On‑page selection rectangle & result bubble

Implementation notes: a `uiTheme` key is stored in `chrome.storage.sync`; when set to `system` a runtime media query resolves to light/dark. Styles rely on CSS custom properties (`--*`) so additional themes (e.g. Sepia, High Contrast) can be added by introducing new data-theme blocks.

## Local / Offline OCR

No local or offline OCR path is included. All OCR occurs against Azure Vision. To add a local provider in the future you would introduce a custom endpoint + host permission and branching logic in `content/selection.js`.

## Azure AI Vision OCR (Enforced Mode)

When configured, the extension posts the raw PNG bytes (cropped selection) to the Azure Vision Image Analysis (Read feature) endpoint:

`POST {endpoint}/computervision/imageanalysis:analyze?api-version=2024-02-01&features=read&model-version=<MODEL>`

Headers:
```
Ocp-Apim-Subscription-Key: <VISION_KEY>
Content-Type: application/octet-stream
```

Body: Binary image data (PNG) extracted from the screenshot region.

Response (simplified) contains `readResult` with blocks/pages -> lines; lines are concatenated with newlines for display.

Model Version: You can override to newer preview GA versions as Azure releases them.

Rate Limits: Be mindful of per-second call limits on your pricing tier; rapid selections may hit limits.

Fallback: If Vision key/endpoint are missing the extension displays an error bubble; no alternate provider exists.

## Azure Translation Call

If auto-translate + key configured, the extension POSTs to the Azure endpoint (e.g.:
`https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=en`).

Body:
```
[{ "Text": "<OCR RESULT>" }]
```
Headers:
```
Ocp-Apim-Subscription-Key: <KEY>
Ocp-Apim-Subscription-Region: <REGION?>
Content-Type: application/json; charset=UTF-8
```

Response (trimmed example):
```
[
    {
        "translations": [ { "text": "Translated text", "to": "en" } ]
    }
]
```

If translation fails, the original OCR result is still shown.

## How to Load the Extension (Unpacked)

1. Build step: none (plain JS/CSS/HTML currently).
2. Open Chrome / Edge -> `chrome://extensions`.
3. Enable Developer Mode (top right).
4. Click "Load unpacked" and select the project folder.
5. (Optional) Adjust shortcut at `chrome://extensions/shortcuts`.

## Usage

1. Press the keyboard shortcut or click the toolbar icon then "Start Selection".
2. Drag a rectangle over the desired text region. Release mouse.
3. A bubble shows: "Processing OCR..." then the recognized (and optionally translated) text.
4. Bubble auto-closes after a few seconds; last result stored for quick reference in popup.
5. Press Esc while selecting to cancel.

## Customization Ideas / Next Steps

- Add TypeScript build pipeline (Vite / esbuild) for future complexity.
- Add vertical-text specialized OCR pre-processing (binarization, rotation hints) on backend.
- Implement in-extension translation provider switcher.
- Add copy-to-clipboard & pin bubble features.
- Provide loading spinner or progress states.
- Internationalize extension UI.

## Security / Privacy Notes

- Cropped images are sent only to your configured Azure Vision endpoint over HTTPS.
- Translation text only (no image) is sent to Azure Translator if enabled.
- No analytics or external calls beyond the configured endpoints.

## Troubleshooting

| Issue | Possible Cause | Fix |
|-------|----------------|-----|
| Blank result | OCR backend empty response | Check backend logs / ensure it returns `{ text: "..." }` |
| Translation missing | Key/region not set or endpoint incorrect | Verify options page entries |
| Selection overlay never appears | Content script injection blocked | Reload tab or re-install extension |
| Screenshot fails | Permission / protected page | Try a normal HTTP(S) page, some chrome:// pages are restricted |

## License

Add a license file of your choice (MIT recommended) – not included yet.

---

This scaffold should get you started quickly; extend it as backend & UI mature.
