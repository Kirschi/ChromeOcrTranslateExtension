// bubble.js - Result bubble UI utilities
(function (ns) {
  if (ns.bubble) return;
  const { STORAGE_KEYS } = ns.constants;
  const state = ns.state;

  function removeBubble() {
    if (state.bubbleEl?.parentNode) state.bubbleEl.parentNode.removeChild(state.bubbleEl);
    state.bubbleEl = null;
  }

  function showBubble(text, x, y, lang, isError = false, { spinner = false } = {}) {
    removeBubble();
    const bubble = document.createElement('div');
    bubble.className = 'ocr-result-bubble' + (isError ? ' ocr-result-error' : '');
    // If coordinates flagged as 'reuse', use stored last position
    if (x === '__reuse' && y === '__reuse' && state.lastBubblePos) {
      x = state.lastBubblePos.x;
      y = state.lastBubblePos.y;
    }

    // Header (draggable handle)
    const header = document.createElement('div');
    header.className = 'ocr-bubble-header';
    const title = document.createElement('span');
    title.className = 'ocr-bubble-title';
    title.textContent = 'OCR Result';
    header.appendChild(title);
    const btnGroup = document.createElement('div');
    btnGroup.className = 'ocr-bubble-header-buttons';

    const repeatBtn = document.createElement('button');
    repeatBtn.className = 'ocr-bubble-repeat';
    repeatBtn.textContent = '↺';
    repeatBtn.title = 'Do another snip';
    repeatBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Preserve current position
      const rect = bubble.getBoundingClientRect();
      state.lastBubblePos = { x: rect.left, y: rect.top };
      // Start selection again
      try { window.__startOcrSelection?.(); } catch (_) { }
    });
    btnGroup.appendChild(repeatBtn);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.className = 'ocr-bubble-close';
    closeBtn.title = 'Close';
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); removeBubble(); });
    btnGroup.appendChild(closeBtn);

    header.appendChild(btnGroup);
    bubble.appendChild(header);

    // OCR Section
    const ocrSection = document.createElement('div');
    ocrSection.className = 'ocr-section';
    if (lang) {
      const span = document.createElement('span');
      span.className = 'lang';
      span.textContent = lang;
      ocrSection.appendChild(span);
    }
    const contentSpan = document.createElement('div');
    contentSpan.className = 'ocr-bubble-text';
    contentSpan.textContent = text;
    contentSpan.contentEditable = 'true';
    contentSpan.setAttribute('data-original-text', text);
    contentSpan.spellcheck = false;
    if (spinner) {
      const spin = document.createElement('span');
      spin.className = 'ocr-bubble-spinner';
      contentSpan.appendChild(spin);
    }
    ocrSection.appendChild(contentSpan);
    bubble.appendChild(ocrSection);

    // Translation Section (always visible, may start empty)
    const transSection = document.createElement('div');
    transSection.className = 'ocr-translation-section';
    const transHeader = document.createElement('div');
    transHeader.className = 'ocr-translation-header';
    transHeader.textContent = 'Translation'; // provider tag appended later in addActionButtons
    transSection.appendChild(transHeader);
    const transBody = document.createElement('div');
    transBody.className = 'ocr-translation-body';
    transBody.textContent = '';
    transSection.appendChild(transBody);
    bubble.appendChild(transSection);

    // Actions container (outside sections to remain bottom aligned)
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'ocr-bubble-actions';
    bubble.appendChild(actionsContainer);

    document.body.appendChild(bubble);
    const rect = bubble.getBoundingClientRect();
    bubble.style.left = Math.max(4, Math.min(x, window.innerWidth - rect.width - 4)) + 'px';
    bubble.style.top = Math.max(4, Math.min(y, window.innerHeight - rect.height - 4)) + 'px';
    state.bubbleEl = bubble;
    // Persist last position
    const finalRect = bubble.getBoundingClientRect();
    state.lastBubblePos = { x: finalRect.left, y: finalRect.top };

    // Drag logic
    (function enableDrag() {
      let dragging = false;
      let offsetX = 0, offsetY = 0;
      header.style.cursor = 'move';
      function onMouseDown(e) {
        if (e.button !== 0) return; // left only
        dragging = true;
        const rect = bubble.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp, { once: true });
        e.preventDefault();
      }
      function onMouseMove(e) {
        if (!dragging) return;
        let nx = e.clientX - offsetX;
        let ny = e.clientY - offsetY;
        // clamp within viewport (some padding)
        const pad = 4;
        const rect = bubble.getBoundingClientRect();
        nx = Math.min(window.innerWidth - rect.width - pad, Math.max(pad, nx));
        ny = Math.min(window.innerHeight - rect.height - pad, Math.max(pad, ny));
        bubble.style.left = nx + 'px';
        bubble.style.top = ny + 'px';
      }
      function onMouseUp() { dragging = false; document.removeEventListener('mousemove', onMouseMove); }
      header.addEventListener('mousedown', onMouseDown);
      // Touch support (basic)
      header.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        dragging = true;
        const rect = bubble.getBoundingClientRect();
        offsetX = t.clientX - rect.left;
        offsetY = t.clientY - rect.top;
      }, { passive: true });
      window.addEventListener('touchmove', (e) => {
        if (!dragging) return;
        const t = e.touches[0];
        let nx = t.clientX - offsetX;
        let ny = t.clientY - offsetY;
        const pad = 4;
        const rect = bubble.getBoundingClientRect();
        nx = Math.min(window.innerWidth - rect.width - pad, Math.max(pad, nx));
        ny = Math.min(window.innerHeight - rect.height - pad, Math.max(pad, ny));
        bubble.style.left = nx + 'px';
        bubble.style.top = ny + 'px';
      }, { passive: true });
      window.addEventListener('touchend', () => { dragging = false; });
    })();
  }

  async function addActionButtons({ showTranslate, originalText, preFetchedTranslation = null }) {
    if (!state.bubbleEl) return;
    const actions = state.bubbleEl.querySelector('.ocr-bubble-actions');
    if (!actions) return;
    const transSection = state.bubbleEl.querySelector('.ocr-translation-section');
    const transBody = state.bubbleEl.querySelector('.ocr-translation-body');
    const transHeader = state.bubbleEl.querySelector('.ocr-translation-header');
    // Add provider label
    try {
      const cfg = await ns.getConfig();
      const provider = cfg.translationProvider === 'google' ? 'Google' : 'Azure';
      if (transHeader && !transHeader.querySelector('span.provider')) {
        const prov = document.createElement('span');
        prov.className = 'provider';
        prov.textContent = ` (${provider})`;
        transHeader.appendChild(prov);
      }
    } catch (_) { }

    if (showTranslate) {
      const btnTrans = document.createElement('button');
      btnTrans.className = 'ocr-btn-primary';
      const OCR_SELECTOR = '.ocr-bubble-text';
      let lastSourceUsed = originalText;
      let lastTranslation = preFetchedTranslation || null;
      if (preFetchedTranslation) { transBody.textContent = preFetchedTranslation; }
      btnTrans.textContent = 'Translate';
      async function performTranslate() {
        if (!transBody) return;
        const ocrEl = state.bubbleEl.querySelector(OCR_SELECTOR);
        if (!ocrEl) return;
        const currentText = ocrEl.textContent || '';
        if (currentText === lastSourceUsed && lastTranslation) {
          transBody.textContent = lastTranslation;
          return;
        }
        btnTrans.disabled = true;
        const prev = btnTrans.textContent;
        btnTrans.textContent = 'Translating...';
        try {
          const translated = await ns.translate.forceTranslate(currentText);
          lastSourceUsed = currentText;
          lastTranslation = translated;
          transBody.textContent = translated || '';
          btnTrans.textContent = translated ? 'Translate' : 'No translation';
        } catch (e) {
          console.error('[OCR SNIP] Manual translate error', e);
          btnTrans.textContent = 'Error';
        } finally {
          btnTrans.disabled = false;
        }
      }
      btnTrans.addEventListener('click', performTranslate);
      actions.appendChild(btnTrans);
    }
    const btnG = document.createElement('button');
    btnG.className = 'ocr-btn-external';
    btnG.innerHTML = 'Google Translate <span class="ocr-ext-icon" aria-label="opens in new tab" title="Opens in new tab">↗</span>';
    btnG.addEventListener('click', () => {
      const url = 'https://translate.google.com/?sl=auto&tl=en&text=' + encodeURIComponent(originalText) + '&op=translate';
      window.open(url, '_blank', 'noopener');
    });
    actions.appendChild(btnG);
  }

  ns.bubble = { showBubble, removeBubble, addActionButtons };
})(window.__ocrSnip = window.__ocrSnip || {});
