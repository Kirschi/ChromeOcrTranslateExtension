import { STORAGE_KEYS, DEFAULTS } from '../src/messages.js';

const els = {};

document.addEventListener('DOMContentLoaded', () => {
  console.log('[OCR SNIP][OPTIONS] DOMContentLoaded');
  els.form = document.getElementById('settingsForm');
  els.azureTranslateEndpoint = document.getElementById('azureTranslateEndpoint');
  els.azureTranslateKey = document.getElementById('azureTranslateKey');
  els.azureTranslateRegion = document.getElementById('azureTranslateRegion');
  els.translationProvider = document.getElementById('translationProvider');
  els.googleTranslateApiKey = document.getElementById('googleTranslateApiKey');
  els.autoTranslate = document.getElementById('autoTranslate');
  els.ignoreNewlines = document.getElementById('ignoreNewlines');
  els.status = document.getElementById('status');
  // New Vision fields
  els.azureVisionEndpoint = document.getElementById('azureVisionEndpoint');
  els.azureVisionKey = document.getElementById('azureVisionKey');
  els.azureVisionReadModel = document.getElementById('azureVisionReadModel');
  els.visionConfig = document.getElementById('visionConfig');
  els.uiTheme = document.getElementById('uiTheme');
  load();
  els.form.addEventListener('submit', onSave);
  const shortcutLink = document.getElementById('shortcutLink');
  if (shortcutLink) {
    shortcutLink.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('[OCR SNIP][OPTIONS] Open shortcuts page');
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });
  }
});

function load() {
  console.log('[OCR SNIP][OPTIONS] Loading config');
  chrome.storage.sync.get(null, (vals) => {
    // Populate fields directly from sync
    els.azureVisionEndpoint.value = vals[STORAGE_KEYS.AZURE_VISION_ENDPOINT] || DEFAULTS.azureVisionEndpoint;
    els.azureVisionKey.value = vals[STORAGE_KEYS.AZURE_VISION_KEY] || DEFAULTS.azureVisionKey;
    els.azureVisionReadModel.value = vals[STORAGE_KEYS.AZURE_VISION_READ_MODEL] || DEFAULTS.azureVisionReadModel;
    els.visionConfig.classList.add('active');
    els.azureTranslateEndpoint.value = vals[STORAGE_KEYS.AZURE_TRANSLATE_ENDPOINT] || DEFAULTS.azureTranslateEndpoint;
    els.azureTranslateKey.value = vals[STORAGE_KEYS.AZURE_TRANSLATE_KEY] || '';
    els.azureTranslateRegion.value = vals[STORAGE_KEYS.AZURE_TRANSLATE_REGION] || '';
    if (els.translationProvider) {
      els.translationProvider.value = vals[STORAGE_KEYS.TRANSLATION_PROVIDER] || DEFAULTS.translationProvider || 'azure';
      updateProviderVisibility();
      els.translationProvider.addEventListener('change', updateProviderVisibility);
    }
    if (els.googleTranslateApiKey) {
      els.googleTranslateApiKey.value = vals[STORAGE_KEYS.GOOGLE_TRANSLATE_API_KEY] || '';
    }
    els.autoTranslate.checked = vals[STORAGE_KEYS.AUTO_TRANSLATE] !== false;
    if (els.ignoreNewlines) {
      els.ignoreNewlines.checked = vals[STORAGE_KEYS.IGNORE_NEWLINES] !== false; // default true
    }
    if (els.uiTheme) {
      const themeVal = vals[STORAGE_KEYS.UI_THEME] || DEFAULTS.uiTheme || 'system';
      els.uiTheme.value = ['system', 'light', 'dark'].includes(themeVal) ? themeVal : 'system';
      applyPreviewTheme(els.uiTheme.value);
      els.uiTheme.addEventListener('change', () => applyPreviewTheme(els.uiTheme.value));
    }
  });
}

function onSave(e) {
  e.preventDefault();
  console.log('[OCR SNIP][OPTIONS] Saving settings');
  const syncData = {
    [STORAGE_KEYS.AZURE_VISION_ENDPOINT]: els.azureVisionEndpoint.value.trim(),
    [STORAGE_KEYS.AZURE_VISION_READ_MODEL]: els.azureVisionReadModel.value.trim(),
    [STORAGE_KEYS.AZURE_TRANSLATE_ENDPOINT]: els.azureTranslateEndpoint.value.trim(),
    [STORAGE_KEYS.AZURE_TRANSLATE_REGION]: els.azureTranslateRegion.value.trim(),
    ...(els.translationProvider ? { [STORAGE_KEYS.TRANSLATION_PROVIDER]: els.translationProvider.value } : {}),
    [STORAGE_KEYS.AUTO_TRANSLATE]: els.autoTranslate.checked,
    ...(els.ignoreNewlines ? { [STORAGE_KEYS.IGNORE_NEWLINES]: els.ignoreNewlines.checked } : {}),
    ...(els.uiTheme ? { [STORAGE_KEYS.UI_THEME]: els.uiTheme.value } : {}),
    [STORAGE_KEYS.AZURE_VISION_KEY]: els.azureVisionKey.value.trim(),
    [STORAGE_KEYS.AZURE_TRANSLATE_KEY]: els.azureTranslateKey.value.trim(),
    ...(els.googleTranslateApiKey ? { [STORAGE_KEYS.GOOGLE_TRANSLATE_API_KEY]: els.googleTranslateApiKey.value.trim() } : {})
  };
  chrome.storage.sync.set(syncData, () => {
    els.status.textContent = 'Saved';
    setTimeout(() => (els.status.textContent = ''), 1500);
  });
}

// Provider toggle removed: Azure Vision enforced.

function applyPreviewTheme(choice) {
  let theme = choice;
  if (theme === 'system') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    theme = mq.matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = theme;
}

function updateProviderVisibility() {
  if (!els.translationProvider) return;
  const provider = els.translationProvider.value;
  const useGoogle = provider === 'google';
  // Google section always visible now; simply disable irrelevant inputs
  if (els.azureTranslateEndpoint) els.azureTranslateEndpoint.disabled = useGoogle;
  if (els.azureTranslateKey) {
    els.azureTranslateKey.disabled = useGoogle;
    els.azureTranslateKey.required = !useGoogle; // required only when Azure active
  }
  if (els.azureTranslateRegion) els.azureTranslateRegion.disabled = useGoogle;
  if (els.googleTranslateApiKey) {
    // Disable Google key input when Azure is selected; enable & require only for Google
    els.googleTranslateApiKey.disabled = !useGoogle;
    els.googleTranslateApiKey.required = useGoogle;
  }
}
