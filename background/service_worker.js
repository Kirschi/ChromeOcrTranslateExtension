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
      await sendStartSelection(tab.id, tab.url);
    } catch (e) {
      console.warn('Failed to start selection', e);
      console.warn('[OCR SNIP][BG] This can happen if page is a chrome:// page, Web Store, PDF viewer, or permission missing. Current URL:', tab?.url);
      console.warn('[OCR SNIP][BG] Ensure activeTab permission is present (added) and reload the extension then retry on a normal https:// page.');
    }
  }
});

async function sendStartSelection(tabId, url, attempt = 1) {
  console.log('[OCR SNIP][BG] Sending START_SELECTION to tab', tabId, '(attempt', attempt + ')');
  try {
    await chrome.tabs.sendMessage(tabId, { type: MSG.START_SELECTION });
  } catch (err) {
    const msg = String(err || 'unknown');
    if (/Receiving end does not exist/i.test(msg) && attempt < 2) {
      console.warn('[OCR SNIP][BG] No receiver yet; reinjecting then retrying once');
      await ensureContent(tabId);
      return sendStartSelection(tabId, url, attempt + 1);
    }
    throw err;
  }
}

async function ensureContent(tabId) {
  // Inject modular content scripts in order (dependency order matters)
  const files = [
    'content/constants.js',
    'content/state.js',
    'content/ocr.js',
    'content/translate.js',
    'content/bubble.js',
    'content/overlay.js',
    'content/selection.js' // orchestrator last
  ];
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files });
    console.log('[OCR SNIP][BG] Injected content modules into', tabId);
  } catch (err) {
    console.error('[OCR SNIP][BG] executeScript failed', err);
    throw err;
  }
  try {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ['content/overlay.css'] });
  } catch (err) {
    console.error('[OCR SNIP][BG] insertCSS failed', err);
    throw err;
  }
  console.log('[OCR SNIP][BG] Inserted overlay.css into', tabId);

  // Post-injection verification by running a small probe in the page
  try {
    const probe = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const ns = window.__ocrSnip || {};
        return {
          hasConstants: !!ns.constants,
          hasState: !!ns.state,
          hasOcr: !!ns.ocr,
          hasTranslate: !!ns.translate,
          hasBubble: !!ns.bubble,
          hasSelection: !!ns.__mainLoaded
        };
      }
    });
    const result = probe?.[0]?.result;
    console.log('[OCR SNIP][BG] Post-inject probe', result);
    const missing = Object.entries(result || {}).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) {
      console.warn('[OCR SNIP][BG] Some modules missing after injection:', missing);
    }
  } catch (probeErr) {
    console.warn('[OCR SNIP][BG] Probe failed', probeErr);
  }
}

