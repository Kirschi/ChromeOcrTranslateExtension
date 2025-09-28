import { MSG, STORAGE_KEYS, DEFAULTS } from '../src/messages.js';
console.log('[OCR SNIP][BG] Service worker script loaded at', new Date().toISOString());

chrome.runtime.onStartup.addListener(() => {
  console.log('[OCR SNIP][BG] onStartup fired (browser start or extension restarted)');
});

// Ensure defaults exist
chrome.runtime.onInstalled.addListener(() => {
  console.log('[OCR SNIP][BG] onInstalled - ensuring defaults');
  chrome.storage.sync.get(Object.values(STORAGE_KEYS), (vals) => {
    const toSet = {};
    for (const [k, defVal] of Object.entries(DEFAULTS)) {
      if (vals[k] === undefined) toSet[k] = defVal;
    }
    if (Object.keys(toSet).length) {
      console.log('[OCR SNIP][BG] Setting defaults', toSet);
      chrome.storage.sync.set(toSet);
    }
  });
});

async function captureVisible(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(undefined, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(dataUrl);
      }
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case MSG.CAPTURE_TAB: {
        console.log('[OCR SNIP][BG] CAPTURE_TAB request from tab', sender?.tab?.id);
        try {
          const img = await captureVisible(sender.tab.id);
          console.log('[OCR SNIP][BG] captureVisible success (length)', img?.length);
          sendResponse({ ok: true, type: MSG.TAB_CAPTURED, dataUrl: img });
        } catch (e) {
          console.error('[OCR SNIP][BG] captureVisible failed', e);
          sendResponse({ ok: false, type: MSG.ERROR, error: String(e) });
        }
        break;
      }
      default:
        // no-op
        break;
    }
  })();
  return true; // keep port open for async
});

// Keyboard command to start selection by injecting content script if not yet
chrome.commands?.onCommand.addListener(async (command) => {
  if (command === 'trigger-snip') {
    console.log('[OCR SNIP][BG] Keyboard command trigger-snip');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    try {
      await ensureContent(tab.id);
      console.log('[OCR SNIP][BG] Sending START_SELECTION to tab', tab.id);
      chrome.tabs.sendMessage(tab.id, { type: MSG.START_SELECTION });
    } catch (e) {
      console.warn('Failed to start selection', e);
      console.warn('[OCR SNIP][BG] This can happen if page is a chrome:// page, Web Store, PDF viewer, or permission missing. Current URL:', tab?.url);
      console.warn('[OCR SNIP][BG] Ensure activeTab permission is present (added) and reload the extension then retry on a normal https:// page.');
    }
  }
});

async function ensureContent(tabId) {
  // MV3: use scripting.executeScript
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/selection.js']
    });
  } catch (err) {
    console.error('[OCR SNIP][BG] executeScript failed', err);
    throw err;
  }
  console.log('[OCR SNIP][BG] Injected selection.js into', tabId);
  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content/overlay.css']
    });
  } catch (err) {
    console.error('[OCR SNIP][BG] insertCSS failed', err);
    throw err;
  }
  console.log('[OCR SNIP][BG] Inserted overlay.css into', tabId);
}
