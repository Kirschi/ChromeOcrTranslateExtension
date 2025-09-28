// constants.js - Shared constants for OCR Snipper content scripts
// Plain script (not ES module) so it can be injected without special manifest requirements.
(function (ns) {
  if (ns.constants) return; // idempotent
  const MSG = {
    START_SELECTION: 'START_SELECTION',
    CAPTURE_TAB: 'CAPTURE_TAB',
    TAB_CAPTURED: 'TAB_CAPTURED',
    OCR_REQUEST: 'OCR_REQUEST',
    OCR_RESULT: 'OCR_RESULT',
    TRANSLATE_REQUEST: 'TRANSLATE_REQUEST',
    TRANSLATE_RESULT: 'TRANSLATE_RESULT',
    ERROR: 'ERROR'
  };
  const STORAGE_KEYS = {
    AZURE_VISION_ENDPOINT: 'azureVisionEndpoint',
    AZURE_VISION_KEY: 'azureVisionKey',
    AZURE_VISION_READ_MODEL: 'azureVisionReadModel',
    AZURE_TRANSLATE_ENDPOINT: 'azureTranslateEndpoint',
    AZURE_TRANSLATE_KEY: 'azureTranslateKey',
    AZURE_TRANSLATE_REGION: 'azureTranslateRegion',
    TRANSLATION_PROVIDER: 'translationProvider', // 'azure' | 'google'
    GOOGLE_TRANSLATE_API_KEY: 'googleTranslateApiKey',
    AUTO_TRANSLATE: 'autoTranslate',
    LAST_RESULT: 'lastResult',
    UI_THEME: 'uiTheme',
    IGNORE_NEWLINES: 'ignoreNewlines'
  };
  ns.constants = { MSG, STORAGE_KEYS };
})(window.__ocrSnip = window.__ocrSnip || {});
