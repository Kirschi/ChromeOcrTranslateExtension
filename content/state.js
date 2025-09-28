/**
 * state.js
 * --------
 * Shared mutable UI + runtime state for the injected content environment.
 * Exposes:
 *  - state: ephemeral selection + bubble positioning data.
 *  - getConfig(): loads user configuration values from chrome.storage.sync (async).
 *  - applyTheme(): applies resolved theme (system|light|dark) to overlay root and document.
 * Idempotent so re‑injection will not overwrite existing state object.
 */
(function (ns) {
  if (ns.state) return;
  const state = {
    selecting: false,
    startX: 0,
    startY: 0,
    rectEl: null,
    rootEl: null,
    bubbleEl: null,
    lastBubblePos: null
  };

  /**
   * getConfig
   * Resolve current configuration values from chrome.storage.sync, supplying defaults for missing entries.
   * @returns {Promise<object>} configuration object consumed by OCR / translation flows.
   */
  function getConfig() {
    const { STORAGE_KEYS } = ns.constants;
    return new Promise((resolve) => {
      chrome.storage.sync.get(null, (vals) => {
        resolve({
          azureVisionEndpoint: vals[STORAGE_KEYS.AZURE_VISION_ENDPOINT] || '',
          azureVisionKey: vals[STORAGE_KEYS.AZURE_VISION_KEY] || '',
          azureVisionReadModel: vals[STORAGE_KEYS.AZURE_VISION_READ_MODEL] || 'latest',
          azureTranslateEndpoint: vals[STORAGE_KEYS.AZURE_TRANSLATE_ENDPOINT] || '',
          azureTranslateKey: vals[STORAGE_KEYS.AZURE_TRANSLATE_KEY] || '',
          azureTranslateRegion: vals[STORAGE_KEYS.AZURE_TRANSLATE_REGION] || '',
          translationProvider: vals[STORAGE_KEYS.TRANSLATION_PROVIDER] || 'azure',
          googleTranslateApiKey: vals[STORAGE_KEYS.GOOGLE_TRANSLATE_API_KEY] || '',
          autoTranslate: vals[STORAGE_KEYS.AUTO_TRANSLATE] !== false,
          ignoreNewlines: vals[STORAGE_KEYS.IGNORE_NEWLINES] !== false
        });
      });
    });
  }

  /**
   * applyTheme
   * Determine effective theme. For 'system', queries prefers-color-scheme. Sets dataset attributes
   * used by CSS to style overlay + bubble.
   * @param {HTMLElement} rootEl Root overlay element receiving data-theme attribute.
   */
  function applyTheme(rootEl) {
    const { STORAGE_KEYS } = ns.constants;
    try {
      chrome.storage.sync.get(STORAGE_KEYS.UI_THEME, (vals) => {
        let choice = vals[STORAGE_KEYS.UI_THEME] || 'system';
        if (choice === 'system') {
          const mq = window.matchMedia('(prefers-color-scheme: dark)');
          choice = mq.matches ? 'dark' : 'light';
        }
        rootEl.dataset.theme = choice;
        document.documentElement.dataset.ocrTheme = choice;
      });
    } catch (_) { }
  }

  ns.state = state;
  ns.getConfig = getConfig;
  ns.applyTheme = applyTheme;
})(window.__ocrSnip = window.__ocrSnip || {});
