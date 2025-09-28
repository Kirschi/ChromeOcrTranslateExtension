/**
 * overlay.js
 * ----------
 * Manages the semi-transparent full-page overlay allowing the user to drag a selection rectangle.
 * Exports functions to begin and destroy the overlay; internal mouse/key handlers update geometry.
 * Emits the final rectangle via supplied callback once mouse is released (size threshold enforced).
 */
(function (ns) {
  if (ns.overlay) return;
  const { MSG } = ns.constants;
  const state = ns.state;

  let onComplete = null; // callback(selection)

  /**
   * beginSelection
   * Start a new selection lifecycle; inject overlay if not present and register completion callback.
   * @param {Function} cb Callback receiving final {left,top,width,height} rectangle.
   */
  function beginSelection(cb) {
    onComplete = cb;
    createOverlay();
  }

  /**
   * createOverlay
   * Materialize overlay root + mask + rectangle elements and attach input listeners (idempotent check).
   */
  function createOverlay() {
    if (state.rootEl) {
      console.log('[OCR SNIP] Overlay already exists');
      return;
    }
    console.log('[OCR SNIP] Creating overlay for selection');
    const root = document.createElement('div');
    root.className = 'ocr-snip-overlay-root';
    ns.applyTheme(root);
    const mask = document.createElement('div'); mask.className = 'ocr-snip-mask'; root.appendChild(mask);
    const rect = document.createElement('div'); rect.className = 'ocr-snip-rect'; root.appendChild(rect);
    document.body.appendChild(root);
    state.rootEl = root; state.rectEl = rect;
    root.addEventListener('mousedown', onMouseDown, { capture: true });
    window.addEventListener('mousemove', onMouseMove, true);
    window.addEventListener('mouseup', onMouseUp, true);
    window.addEventListener('keydown', onKeyDown, true);
  }

  /**
   * destroyOverlay
   * Fully remove overlay + listeners; used after successful selection or cancel.
   */
  function destroyOverlay() {
    if (state.rootEl?.parentNode) state.rootEl.parentNode.removeChild(state.rootEl);
    state.rootEl = null; state.rectEl = null; state.selecting = false;
    window.removeEventListener('mousemove', onMouseMove, true);
    window.removeEventListener('mouseup', onMouseUp, true);
    window.removeEventListener('keydown', onKeyDown, true);
  }

  /**
   * removeOverlayOnly
   * Remove overlay elements but avoid side effects on bubble; used mid-pipeline.
   */
  function removeOverlayOnly() {
    if (state.rootEl?.parentNode) state.rootEl.parentNode.removeChild(state.rootEl);
    state.rootEl = null; state.rectEl = null; state.selecting = false;
    window.removeEventListener('mousemove', onMouseMove, true);
    window.removeEventListener('mouseup', onMouseUp, true);
    window.removeEventListener('keydown', onKeyDown, true);
  }

  /** Handle ESC key to cancel selection & remove bubble. */
  function onKeyDown(e) { if (e.key === 'Escape') { console.log('[OCR SNIP] Escape pressed, cancelling'); destroyOverlay(); ns.bubble.removeBubble(); } }
  /** Initialize drag start and seed rectangle. */
  function onMouseDown(e) { e.preventDefault(); state.selecting = true; state.startX = e.clientX; state.startY = e.clientY; updateRect(e.clientX, e.clientY); }
  /** Update rectangle while dragging. */
  function onMouseMove(e) { if (!state.selecting) return; updateRect(e.clientX, e.clientY); }
  /** Finalize selection, minimal size gate, invoke callback or cancel. */
  function onMouseUp(e) { if (!state.selecting) return; state.selecting = false; const sel = getRectValues(e.clientX, e.clientY); if (sel.width < 4 || sel.height < 4) { console.log('[OCR SNIP] Selection too small'); destroyOverlay(); return; } console.log('[OCR SNIP] Final selection', sel); if (onComplete) onComplete(sel); }

  /** Apply latest pointer coordinates to rectangle element; toggles small-size hint using DPR threshold. */
  function updateRect(currentX, currentY) { const { left, top, width, height } = getRectValues(currentX, currentY); Object.assign(state.rectEl.style, { left: left + 'px', top: top + 'px', width: width + 'px', height: height + 'px' }); const dpr = window.devicePixelRatio || 1; const tooSmall = (width * dpr < 50) || (height * dpr < 50); if (tooSmall) state.rectEl.classList.add('ocr-snip-rect-small'); else state.rectEl.classList.remove('ocr-snip-rect-small'); }
  /** Compute normalized rectangle from anchor + current pointer. */
  function getRectValues(currentX, currentY) { const left = Math.min(state.startX, currentX); const top = Math.min(state.startY, currentY); const width = Math.abs(currentX - state.startX); const height = Math.abs(currentY - state.startY); return { left, top, width, height }; }

  ns.overlay = { beginSelection, createOverlay, destroyOverlay, removeOverlayOnly };
})(window.__ocrSnip = window.__ocrSnip || {});
