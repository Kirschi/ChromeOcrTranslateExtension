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

    // Header (draggable handle)
    const header = document.createElement('div');
    header.className = 'ocr-bubble-header';
    const title = document.createElement('span');
    title.className = 'ocr-bubble-title';
    title.textContent = 'OCR Result';
    header.appendChild(title);
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.className = 'ocr-bubble-close';
    closeBtn.addEventListener('click', () => removeBubble());
    header.appendChild(closeBtn);
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

    // Translation Section (hidden until requested)
    const transSection = document.createElement('div');
    transSection.className = 'ocr-translation-section hidden';
    const transHeader = document.createElement('div');
    transHeader.className = 'ocr-translation-header';
    transHeader.textContent = 'Translation';
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
    if (showTranslate) {
      const btnTrans = document.createElement('button');
      const OCR_SELECTOR = '.ocr-bubble-text';
      const transSection = state.bubbleEl.querySelector('.ocr-translation-section');
      const transBody = state.bubbleEl.querySelector('.ocr-translation-body');
      let lastSourceUsed = originalText;
      let lastTranslation = preFetchedTranslation || null;
      btnTrans.textContent = preFetchedTranslation ? 'Show Translation' : 'Translate';

      async function performTranslate(showOnly = false) {
        if (!transSection || !transBody) return;
        const ocrEl = state.bubbleEl.querySelector(OCR_SELECTOR);
        if (!ocrEl) return;
        const currentText = ocrEl.textContent || '';

        // Decide whether we can reuse pre-fetched translation
        let translationToUse = null;
        if (showOnly && lastTranslation && currentText === lastSourceUsed) {
          translationToUse = lastTranslation;
        } else if (currentText === lastSourceUsed && lastTranslation) {
          // Re-show existing
          translationToUse = lastTranslation;
        } else {
          btnTrans.disabled = true;
          const originalLabel = btnTrans.textContent;
          btnTrans.textContent = 'Translating...';
          try {
            translationToUse = await ns.translate.forceTranslate(currentText);
            lastSourceUsed = currentText;
            lastTranslation = translationToUse;
          } catch (e) {
            console.error('[OCR SNIP] Manual translate error', e);
            btnTrans.textContent = 'Error';
            btnTrans.disabled = false;
            return;
          }
        }

        if (translationToUse) {
          transBody.textContent = translationToUse;
          transSection.classList.remove('hidden');
          btnTrans.textContent = 'Translate'; // keep available for re-translation
        } else {
          transBody.textContent = '';
          transSection.classList.remove('hidden');
          btnTrans.textContent = 'No translation';
        }
        btnTrans.disabled = false; // Re-enable for further edits
      }

      btnTrans.addEventListener('click', () => {
        // If translation section hidden and we have pre-fetched translation & text unchanged, just reveal without new request
        const ocrEl = state.bubbleEl.querySelector(OCR_SELECTOR);
        const currentText = ocrEl?.textContent || '';
        const hidden = transSection?.classList.contains('hidden');
        if (hidden && lastTranslation && currentText === lastSourceUsed) {
          performTranslate(true);
        } else {
          performTranslate(false);
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
  }

  ns.bubble = { showBubble, removeBubble, addActionButtons };
})(window.__ocrSnip = window.__ocrSnip || {});
