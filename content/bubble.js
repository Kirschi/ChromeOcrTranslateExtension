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
    state.bubbleEl = bubble;
  }

  async function addActionButtons({ showTranslate, originalText }) {
    if (!state.bubbleEl) return;
    let actions = state.bubbleEl.querySelector('.ocr-bubble-actions');
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
          const translated = await ns.translate.forceTranslate(originalText);
          if (translated) {
            const textSpan = state.bubbleEl.querySelector('.ocr-bubble-text');
            if (textSpan) textSpan.textContent = translated;
            const langTag = state.bubbleEl.querySelector('.lang');
            if (langTag) langTag.textContent = 'Translated'; else {
              const span = document.createElement('span'); span.className = 'lang'; span.textContent = 'Translated'; state.bubbleEl.insertBefore(span, state.bubbleEl.querySelector('.ocr-bubble-text'));
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
    state.bubbleEl.appendChild(actions);
  }

  ns.bubble = { showBubble, removeBubble, addActionButtons };
})(window.__ocrSnip = window.__ocrSnip || {});
