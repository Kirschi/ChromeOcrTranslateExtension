# Chrome OCR Extension

A custom extension that gets the selected snip from the users selection as an image (region snipping). It then sends it to a local OCR service for character recognition. Japanese text, especially vertical ones and from Manga is the priority. The data is then sent to a Azure Translation service. The result is displayed in a small popup inside the browser.

## Architecture

[Chrome Extension] --(image/snippet)--> [Local Backend API]
      ↑                                         ↓
  Overlay translated text <---- (OCR + Translate Result)

## Current Implementation (Scaffold)

This repository contains a Manifest V3 Chrome extension scaffold that:

1. Lets you start a region selection (via popup button or a keyboard shortcut).
2. Captures a screenshot of the current tab and crops it to the selected rectangle client-side.
3. Sends the cropped image (base64 PNG) directly to Azure AI Vision (local backend temporarily disabled).
4. Optionally (if configured) sends the recognized text to Azure Translator as a second independent call.
5. Overlays the (translated or original) text near the selection region and stores the last result.

The OCR and translation steps are intentionally decoupled so the backend only needs to provide OCR initially.

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
    options.html/.js/.css     # Config: OCR endpoint, Azure translate settings, auto-translate toggle
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

`host_permissions` are limited to localhost (OCR service) and Azure Translator endpoints.

If you later implement the OCR entirely in-page (e.g. WebAssembly) and drop screenshot capture, you may be able to remove or reduce some permissions.

## Keyboard Shortcut

Default: `Ctrl+Shift+Y` (Win/Linux) / `Command+Shift+Y` (macOS)

You can customize it via `chrome://extensions/shortcuts`.

## Configuration (Options Page)

Open the extension's options or visit the popup and click "Settings". Fields:

OCR Provider Section:
* Choose between Local Backend or Azure AI Vision.
* Local OCR Endpoint URL (default: `http://localhost:5000/ocr`).

Azure AI Vision Section (only shown when Vision selected or key+endpoint provided):
* Azure Vision Endpoint (e.g. `https://<resource>.cognitiveservices.azure.com`).
* Azure Vision Key.
* Vision Read Model Version (default `2024-02-29-preview`).

Translation Section:
* Azure Translate Endpoint (full URL with query specifying target language) – default uses `to=en`.
* Azure Translate Key & Region (if required by your Azure resource setup).
* Auto translate toggle – if disabled, only OCR text is displayed.

The last OCR/translation result is stored (shortened) and shown in the popup.

## Local OCR Backend (Temporarily Disabled)

Local backend support has been visually and functionally disabled in this build. The manifest no longer includes localhost host permissions. To re-enable later you would:
1. Re-add localhost host permissions in `manifest.json`.
2. Restore the local provider UI in `options/options.html`.
3. Reintroduce fallback logic in `content/selection.js`.

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

Fallback: If Vision key/endpoint missing the extension now errors (local OCR disabled).

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

- Images (snips) are sent only to the configured local OCR endpoint.
- Translation text only (no image) is sent to Azure if enabled.
- No analytics or external calls beyond the configured endpoints.

## Troubleshooting

| Issue | Possible Cause | Fix |
|-------|----------------|-----|
| Blank result | OCR backend empty response | Check backend logs / ensure it returns `{ text: "..." }` |
| Translation missing | Key/region not set or endpoint incorrect | Verify options page entries |
| Selection overlay never appears | Content script injection blocked | Reload tab or re-install extension |
| Screenshot fails | Permission / protected page | Try a normal HTTP(S) page, some chrome:// pages are restricted |

## Minimal Backend Mock (Example)

Node.js Express quick mock (optional):
```js
import express from 'express';
const app = express();
app.use(express.json({ limit: '10mb' }));
app.post('/ocr', (req, res) => {
    // naive fake OCR returning placeholder
    res.json({ text: 'テスト OCR サンプル' });
});
app.listen(5000, () => console.log('OCR mock on :5000'));
```

## License

Add a license file of your choice (MIT recommended) – not included yet.

---

This scaffold should get you started quickly; extend it as backend & UI mature.
