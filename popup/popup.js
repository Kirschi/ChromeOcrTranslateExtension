/**
 * popup.js
 * --------
 * Logic for the browser action popup: triggers new selection, shows last OCR/translation
 * snippet, displays current shortcut, and links to options page.
 */
import { MSG, STORAGE_KEYS } from '../src/messages.js';
console.log('[OCR SNIP][POPUP] Script evaluated (popup opened) timestamp', Date.now());

/**
 * init
 * Initialize popup UI: theme, shortcut text, event handlers, and last result preview.
 */
async function init() {
  console.log('[OCR SNIP][POPUP] init');
  applyTheme();
  updateShortcutDisplay();
  document.getElementById('startBtn').addEventListener('click', startSelection);
  document.getElementById('openOptions').addEventListener('click', (e) => {
    e.preventDefault();
    console.log('[OCR SNIP][POPUP] Open options clicked');
    chrome.runtime.openOptionsPage();
  });
  loadLast();
}

/**
 * startSelection
 * Inject selection orchestrator assets (idempotent) and send START_SELECTION to active tab.
 */
async function startSelection() {
  console.log('[OCR SNIP][POPUP] Start selection clicked');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  // inject if needed then send start message
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/selection.js'] });
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content/overlay.css'] });
    console.log('[OCR SNIP][POPUP] Injected assets into tab', tab.id);
  } catch (_) { /* ignore */ }
  chrome.tabs.sendMessage(tab.id, { type: MSG.START_SELECTION });
  console.log('[OCR SNIP][POPUP] Sent START_SELECTION to tab', tab.id);
  window.close();
}

/**
 * loadLast
 * Fetch last OCR/translation result from sync storage (if any) and render trimmed preview.
 */
function loadLast() {
  console.log('[OCR SNIP][POPUP] Loading last result');
  chrome.storage.sync.get(STORAGE_KEYS.LAST_RESULT, (vals) => {
    const lr = vals[STORAGE_KEYS.LAST_RESULT];
    const pre = document.getElementById('lastResult');
    if (!lr) { pre.textContent = '(none)'; return; }
    pre.textContent = (lr.translated || lr.ocr || '').slice(0, 500);
  });
}

document.addEventListener('DOMContentLoaded', init);

/**
 * applyTheme
 * Resolve theme (system aware) and assign dataset attribute for styling.
 */
function applyTheme() {
  chrome.storage.sync.get(['uiTheme'], (vals) => {
    let choice = vals.uiTheme || 'system';
    if (choice === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      choice = mq.matches ? 'dark' : 'light';
    }
    document.documentElement.dataset.theme = choice;
  });
}

/**
 * updateShortcutDisplay
 * Query command list and show active shortcut mapping for trigger-snip.
 */
function updateShortcutDisplay() {
  const el = document.getElementById('shortcutDisplay');
  if (!el) return;
  if (!chrome.commands?.getAll) {
    el.textContent = '(not available)';
    return;
  }
  try {
    chrome.commands.getAll((commands) => {
      if (chrome.runtime.lastError) {
        el.textContent = '(error)';
        return;
      }
      const cmd = commands?.find(c => c.name === 'trigger-snip');
      if (!cmd || !cmd.shortcut) {
        el.textContent = '(not set)';
      } else {
        el.textContent = cmd.shortcut;
      }
    });
  } catch (e) {
    el.textContent = '(error)';
  }
}
