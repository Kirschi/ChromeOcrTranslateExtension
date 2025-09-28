import { STORAGE_KEYS, DEFAULTS } from '../src/messages.js';

const els = {};

document.addEventListener('DOMContentLoaded', () => {
  console.log('[OCR SNIP][OPTIONS] DOMContentLoaded');
  els.form = document.getElementById('settingsForm');
  els.azureTranslateEndpoint = document.getElementById('azureTranslateEndpoint');
  els.azureTranslateKey = document.getElementById('azureTranslateKey');
  els.azureTranslateRegion = document.getElementById('azureTranslateRegion');
  els.autoTranslate = document.getElementById('autoTranslate');
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
    els.azureVisionEndpoint.value = vals[STORAGE_KEYS.AZURE_VISION_ENDPOINT] || DEFAULTS.azureVisionEndpoint;
    els.azureVisionKey.value = vals[STORAGE_KEYS.AZURE_VISION_KEY] || DEFAULTS.azureVisionKey;
    els.azureVisionReadModel.value = vals[STORAGE_KEYS.AZURE_VISION_READ_MODEL] || DEFAULTS.azureVisionReadModel;

    // Vision always active now
    els.visionConfig.classList.add('active');
    els.azureTranslateEndpoint.value = vals[STORAGE_KEYS.AZURE_TRANSLATE_ENDPOINT] || DEFAULTS.azureTranslateEndpoint;
    els.azureTranslateKey.value = vals[STORAGE_KEYS.AZURE_TRANSLATE_KEY] || '';
    els.azureTranslateRegion.value = vals[STORAGE_KEYS.AZURE_TRANSLATE_REGION] || '';
    els.autoTranslate.checked = vals[STORAGE_KEYS.AUTO_TRANSLATE] !== false;
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
  const data = {
    [STORAGE_KEYS.AZURE_VISION_ENDPOINT]: els.azureVisionEndpoint.value.trim(),
    [STORAGE_KEYS.AZURE_VISION_KEY]: els.azureVisionKey.value.trim(),
    [STORAGE_KEYS.AZURE_VISION_READ_MODEL]: els.azureVisionReadModel.value.trim(),
    [STORAGE_KEYS.AZURE_TRANSLATE_ENDPOINT]: els.azureTranslateEndpoint.value.trim(),
    [STORAGE_KEYS.AZURE_TRANSLATE_KEY]: els.azureTranslateKey.value.trim(),
    [STORAGE_KEYS.AZURE_TRANSLATE_REGION]: els.azureTranslateRegion.value.trim(),
    [STORAGE_KEYS.AUTO_TRANSLATE]: els.autoTranslate.checked,
    ...(els.uiTheme ? { [STORAGE_KEYS.UI_THEME]: els.uiTheme.value } : {})
  };
  chrome.storage.sync.set(data, () => {
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
