if (!window.__ocrSnipInjected) {
  // Scoped constants so reinjection doesn't cause Identifier has already been declared errors
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
    BACKEND_OCR_URL: 'backendOcrUrl',
    AZURE_VISION_ENDPOINT: 'azureVisionEndpoint',
    AZURE_VISION_KEY: 'azureVisionKey',
    AZURE_VISION_READ_MODEL: 'azureVisionReadModel',
    AZURE_TRANSLATE_ENDPOINT: 'azureTranslateEndpoint',
    AZURE_TRANSLATE_KEY: 'azureTranslateKey',
    AZURE_TRANSLATE_REGION: 'azureTranslateRegion',
    AUTO_TRANSLATE: 'autoTranslate',
    LAST_RESULT: 'lastResult'
  };
  window.__ocrSnipInjected = true;
  console.log('[OCR SNIP] Content script injected');

  let state = {
    selecting: false,
    startX: 0,
    startY: 0,
    rect: null,
    root: null,
    bubble: null
  };

  function createOverlay() {
    if (state.root) {
      console.log('[OCR SNIP] Overlay already exists');
      return;
    }
    console.log('[OCR SNIP] Creating overlay for selection');
    const root = document.createElement('div');
    root.className = 'ocr-snip-overlay-root';

    const mask = document.createElement('div');
    mask.className = 'ocr-snip-mask';
    root.appendChild(mask);

    const rect = document.createElement('div');
    rect.className = 'ocr-snip-rect';
    root.appendChild(rect);

    document.body.appendChild(root);
    state.root = root;
    state.rect = rect;

    root.addEventListener('mousedown', onMouseDown, { capture: true });
    window.addEventListener('mousemove', onMouseMove, true);
    window.addEventListener('mouseup', onMouseUp, true);
    window.addEventListener('keydown', onKeyDown, true);
  }

  function destroyOverlay() {
    console.log('[OCR SNIP] Destroy overlay (and bubble)');
    if (state.root?.parentNode) state.root.parentNode.removeChild(state.root);
    state.root = null;
    state.rect = null;
    state.selecting = false;
    removeBubble();
    window.removeEventListener('mousemove', onMouseMove, true);
    window.removeEventListener('mouseup', onMouseUp, true);
    window.removeEventListener('keydown', onKeyDown, true);
  }

  // Remove selection overlay immediately but keep any existing bubble (used after region chosen)
  function removeOverlayOnly() {
    if (state.root?.parentNode) state.root.parentNode.removeChild(state.root);
    state.root = null;
    state.rect = null;
    state.selecting = false;
    window.removeEventListener('mousemove', onMouseMove, true);
    window.removeEventListener('mouseup', onMouseUp, true);
    window.removeEventListener('keydown', onKeyDown, true);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      console.log('[OCR SNIP] Escape pressed, cancelling');
      destroyOverlay();
    }
  }

  function onMouseDown(e) {
    e.preventDefault();
    console.log('[OCR SNIP] Mouse down at', e.clientX, e.clientY);
    state.selecting = true;
    state.startX = e.clientX;
    state.startY = e.clientY;
    updateRect(e.clientX, e.clientY);
  }

  function onMouseMove(e) {
    if (!state.selecting) return;
    updateRect(e.clientX, e.clientY);
  }

  function onMouseUp(e) {
    if (!state.selecting) return;
    state.selecting = false;
    const { left, top, width, height } = getRectValues(e.clientX, e.clientY);
    if (width < 4 || height < 4) {
      console.log('[OCR SNIP] Selection too small, abort');
      destroyOverlay();
      return;
    }
    // proceed to capture & OCR
    console.log('[OCR SNIP] Final selection', { left, top, width, height });
    requestTabCapture({ left, top, width, height });
  }

  function updateRect(currentX, currentY) {
    const { left, top, width, height } = getRectValues(currentX, currentY);
    Object.assign(state.rect.style, {
      left: left + 'px',
      top: top + 'px',
      width: width + 'px',
      height: height + 'px'
    });
    const dpr = window.devicePixelRatio || 1;
    const tooSmall = (width * dpr < 50) || (height * dpr < 50);
    if (tooSmall) {
      state.rect.classList.add('ocr-snip-rect-small');
    } else {
      state.rect.classList.remove('ocr-snip-rect-small');
    }
  }

  function getRectValues(currentX, currentY) {
    const left = Math.min(state.startX, currentX);
    const top = Math.min(state.startY, currentY);
    const width = Math.abs(currentX - state.startX);
    const height = Math.abs(currentY - state.startY);
    return { left, top, width, height };
  }

  function showBubble(text, x, y, lang, isError = false, { spinner = false } = {}) {
    removeBubble();
    const bubble = document.createElement('div');
    bubble.className = 'ocr-result-bubble' + (isError ? ' ocr-result-error' : '');
    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.className = 'ocr-bubble-close';
    closeBtn.addEventListener('click', () => removeBubble());
    bubble.appendChild(closeBtn);
    if (lang) {
      const span = document.createElement('span');
      span.className = 'lang';
      span.textContent = lang;
      bubble.appendChild(span);
    }
    const contentSpan = document.createElement('span');
    contentSpan.className = 'ocr-bubble-text';
    contentSpan.textContent = text;
    bubble.appendChild(contentSpan);
    if (spinner) {
      const spin = document.createElement('span');
      spin.className = 'ocr-bubble-spinner';
      bubble.appendChild(spin);
    }
    document.body.appendChild(bubble);
    const rect = bubble.getBoundingClientRect();
    bubble.style.left = Math.max(4, Math.min(x, window.innerWidth - rect.width - 4)) + 'px';
    bubble.style.top = Math.max(4, Math.min(y, window.innerHeight - rect.height - 4)) + 'px';
    state.bubble = bubble;
  }

  function addActionButtons({ showTranslate, originalText }) {
    if (!state.bubble) return;
    let actions = state.bubble.querySelector('.ocr-bubble-actions');
    if (actions) actions.remove();
    actions = document.createElement('div');
    actions.className = 'ocr-bubble-actions';
    if (showTranslate) {
      const btnTrans = document.createElement('button');
      btnTrans.textContent = 'Translate';
      btnTrans.addEventListener('click', async () => {
        btnTrans.disabled = true;
        btnTrans.textContent = 'Translating...';
        try {
          const translated = await forceTranslate(originalText);
          if (translated) {
            // Replace bubble content (keep buttons)
            const textSpan = state.bubble.querySelector('.ocr-bubble-text');
            if (textSpan) textSpan.textContent = translated;
            const langTag = state.bubble.querySelector('.lang');
            if (langTag) langTag.textContent = 'Translated'; else {
              const span = document.createElement('span'); span.className = 'lang'; span.textContent = 'Translated'; state.bubble.insertBefore(span, state.bubble.querySelector('.ocr-bubble-text'));
            }
            btnTrans.textContent = 'Translated';
          } else {
            btnTrans.textContent = 'No translation';
          }
        } catch (err) {
          console.error('[OCR SNIP] Manual translate error', err);
          btnTrans.textContent = 'Error';
        }
      });
      actions.appendChild(btnTrans);
    }
    const btnG = document.createElement('button');
    btnG.innerHTML = 'Google Translate <span class="ocr-ext-icon" aria-label="opens in new tab" title="Opens in new tab">↗</span>';
    btnG.addEventListener('click', () => {
      const url = 'https://translate.google.com/?sl=auto&tl=en&text=' + encodeURIComponent(originalText) + '&op=translate';
      window.open(url, '_blank', 'noopener');
    });
    actions.appendChild(btnG);
    state.bubble.appendChild(actions);
  }

  async function forceTranslate(text) {
    const cfg = await getConfig();
    if (!(cfg.azureTranslateKey && cfg.azureTranslateEndpoint)) return null;
    console.log('[OCR SNIP] Manual translate triggered');
    const body = [{ Text: text }];
    const res = await fetch(cfg.azureTranslateEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Ocp-Apim-Subscription-Key': cfg.azureTranslateKey,
        ...(cfg.azureTranslateRegion ? { 'Ocp-Apim-Subscription-Region': cfg.azureTranslateRegion } : {})
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.[0]?.translations?.[0]?.text || null;
  }

  function removeBubble() {
    if (state.bubble?.parentNode) state.bubble.parentNode.removeChild(state.bubble);
    state.bubble = null;
  }

  async function requestTabCapture(selection) {
    const t0 = performance.now();
    console.log('[OCR SNIP] Requesting tab capture');
    try {
      const captureResp = await chrome.runtime.sendMessage({ type: MSG.CAPTURE_TAB });
      if (!captureResp?.ok) throw new Error(captureResp?.error || 'Capture failed');
      console.log('[OCR SNIP] Got full screenshot');
      const cropped = await cropDataUrl(captureResp.dataUrl, selection);
      console.log('[OCR SNIP] Cropped image size (dataURL length):', cropped.length);
      // Immediately remove the heavy overlay UI for snappier UX
      removeOverlayOnly();
      // Minimum dimension check (Azure Vision requires >= 50x50) based on CSS pixels scaled to DPR when drawing
      const dpr = window.devicePixelRatio || 1;
      if (selection.width * dpr < 50 || selection.height * dpr < 50) {
        showBubble('Selection too small (<50px)', selection.left + selection.width + 8, selection.top, 'Error', true);
        return;
      }
      showBubble('Processing OCR...', selection.left + selection.width + 8, selection.top, null, false, { spinner: true });
      const tAfterCrop = performance.now();
      const ocrText = await performOcr(cropped);
      if (!ocrText) throw new Error('Empty OCR result');
      console.log('[OCR SNIP] OCR text length:', ocrText.length);
      const tAfterOcr = performance.now();
      const cfg = await getConfig();
      let translated = null;
      if (cfg.autoTranslate) {
        translated = await maybeTranslate(ocrText);
        if (translated) console.log('[OCR SNIP] Translation text length:', translated.length);
      }
      const display = translated || ocrText;
      showBubble(display, selection.left + selection.width + 8, selection.top, translated ? 'Translated' : 'OCR');
      addActionButtons({ showTranslate: !cfg.autoTranslate, originalText: ocrText });
      chrome.storage.sync.set({ [STORAGE_KEYS.LAST_RESULT]: { ocr: ocrText, translated, ts: Date.now() } });
      const tEnd = performance.now();
      console.log('[OCR SNIP] Timing ms { crop:' + (tAfterCrop - t0).toFixed(1) + ', ocr:' + (tAfterOcr - tAfterCrop).toFixed(1) + ', translate+display:' + (tEnd - tAfterOcr).toFixed(1) + ', total:' + (tEnd - t0).toFixed(1) + ' }');
    } catch (e) {
      console.error('[OCR SNIP] Error during capture/OCR pipeline', e);
      showBubble(String(e), selection.left, selection.top, 'Error', true);
    } finally {
      // No auto-dismiss; user must click X.
    }
  }

  async function cropDataUrl(dataUrl, { left, top, width, height }) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scaleX = window.devicePixelRatio;
        const scaleY = window.devicePixelRatio;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scaleX);
        canvas.height = Math.round(height * scaleY);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(
          img,
          Math.round(left * scaleX),
          Math.round(top * scaleY),
          Math.round(width * scaleX),
          Math.round(height * scaleY),
          0, 0, canvas.width, canvas.height
        );
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  async function performOcr(croppedDataUrl) {
    const cfg = await getConfig();
    if (!(cfg.azureVisionKey && cfg.azureVisionEndpoint)) {
      throw new Error('Azure Vision not configured (endpoint/key required)');
    }
    console.log('[OCR SNIP] Using Azure Vision OCR (forced)');
    return await azureVisionOcr(croppedDataUrl, cfg);
  }

  async function azureVisionOcr(croppedDataUrl, cfg) {
    // Azure Vision Read model: POST {endpoint}/computervision/imageanalysis:analyze?api-version=2024-02-01&features=read
    // Some newer endpoints unify; fallback to classic READ if necessary.
    // We'll try new Image Analysis endpoint first.
    const endpoint = cfg.azureVisionEndpoint.replace(/\/$/, '');
    const modelParam = cfg.azureVisionReadModel || 'latest';
    const url = `${endpoint}/computervision/imageanalysis:analyze?api-version=2024-02-01&features=read&model-version=${encodeURIComponent(modelParam)}`;
    const base64 = croppedDataUrl.split(',')[1];
    const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    console.log('[OCR SNIP] Vision request bytes', binary.length);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': cfg.azureVisionKey,
        'Content-Type': 'application/octet-stream'
      },
      body: binary
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error('Vision HTTP ' + res.status + ' ' + txt.slice(0, 200));
    }
    const json = await res.json();
    console.log('[OCR SNIP] Vision JSON keys', Object.keys(json));
    // New Image Analysis returns readResult inside json.readResult
    // Gather line objects with geometry for potential vertical layout reordering
    const collected = [];
    const pushLines = (arr, keyText, keyContent) => {
      arr?.forEach(l => {
        const text = l[keyText] || l[keyContent] || '';
        if (!text) return;
        // Azure line bounding polygon may be in l.boundingBox (array [x1,y1,...]) or l.polygon
        let box = l.boundingBox || l.polygon;
        let minX = 0, maxX = 0, minY = 0, maxY = 0;
        if (Array.isArray(box) && box.length >= 8) {
          for (let i = 0; i < box.length; i += 2) {
            const x = box[i];
            const y = box[i + 1];
            if (i === 0) { minX = maxX = x; minY = maxY = y; } else { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
          }
        } else if (l.boundingBox?.x !== undefined) {
          // alternative object form (x,y,width,height)
          minX = l.boundingBox.x; minY = l.boundingBox.y; maxX = minX + (l.boundingBox.w || l.boundingBox.width || 0); maxY = minY + (l.boundingBox.h || l.boundingBox.height || 0);
        }
        collected.push({ text, minX, maxX, minY, maxY, height: maxY - minY, width: maxX - minX });
      });
    };
    if (json.readResult?.blocks?.length) {
      json.readResult.blocks.forEach(b => pushLines(b.lines, 'text', 'content'));
    }
    if (!collected.length && json.readResult?.pages?.length) {
      json.readResult.pages.forEach(p => pushLines(p.lines, 'content', 'text'));
    }
    if (!collected.length && typeof json.readResult?.content === 'string') {
      collected.push({ text: json.readResult.content, minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 });
    }
    if (!collected.length && json.readResult?.blocks?.[0]?.lines?.[0]?.text) {
      collected.push({ text: json.readResult.blocks[0].lines[0].text, minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 });
    }

    if (!collected.length) {
      console.warn('[OCR SNIP] No text lines extracted from Vision JSON');
      return '';
    }

    // Simplified ordering: service output assumed top-to-bottom; for desired 3->2->1 order simply reverse.
    const text = collected.map(l => l.text).reverse().map(s => s.trim()).filter(Boolean).join('\n');
    return text;
  }

  async function maybeTranslate(text) {
    const cfg = await getConfig();
    if (!cfg.autoTranslate || !cfg.azureTranslateKey) return null;
    console.log('[OCR SNIP] Performing translation request');
    const endpoint = cfg.azureTranslateEndpoint;
    const body = [{ Text: text }];
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Ocp-Apim-Subscription-Key': cfg.azureTranslateKey,
        ...(cfg.azureTranslateRegion ? { 'Ocp-Apim-Subscription-Region': cfg.azureTranslateRegion } : {})
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) return null;
    const json = await res.json();
    const translated = json?.[0]?.translations?.[0]?.text;
    return translated || null;
  }

  function getConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(null, (vals) => {
        resolve({
          azureVisionEndpoint: vals[STORAGE_KEYS.AZURE_VISION_ENDPOINT] || '',
          azureVisionKey: vals[STORAGE_KEYS.AZURE_VISION_KEY] || '',
          azureVisionReadModel: vals[STORAGE_KEYS.AZURE_VISION_READ_MODEL] || '2024-02-29-preview',
          azureTranslateEndpoint: vals[STORAGE_KEYS.AZURE_TRANSLATE_ENDPOINT] || '',
          azureTranslateKey: vals[STORAGE_KEYS.AZURE_TRANSLATE_KEY] || '',
          azureTranslateRegion: vals[STORAGE_KEYS.AZURE_TRANSLATE_REGION] || '',
          autoTranslate: vals[STORAGE_KEYS.AUTO_TRANSLATE] !== false
        });
      });
    });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === MSG.START_SELECTION) {
      console.log('[OCR SNIP] START_SELECTION message received');
      createOverlay();
    }
  });

  // Expose start for potential direct injection debug
  window.__startOcrSelection = () => createOverlay();
}
