/**
 * selection.js
 * ------------
 * Orchestrates the full pipeline once a user finishes drawing a selection:
 *  capture -> crop -> OCR -> (optional) translate -> display bubble + actions.
 * Handles START_SELECTION messages and exposes a window.__startOcrSelection helper for repeat
 * snips triggered inside the page (e.g., from the bubble repeat button). Idempotent guard ensures
 * only one orchestrator attaches listeners.
 */
(function (ns) {
  if (ns.__mainLoaded) return; // idempotent guard
  ns.__mainLoaded = true;
  console.log('[OCR SNIP] Content orchestrator loaded');
  const { MSG, STORAGE_KEYS } = ns.constants;
  const { showBubble, addActionButtons } = ns.bubble;
  const { cropDataUrl, performOcr } = ns.ocr; // cropDataUrl currently internal use (could be exposed if needed)

  /**
   * handleSelection
   * Execute the ordered OCR pipeline for given selection rectangle and manage user feedback.
   * Logs timing breakdown for performance visibility.
   * @param {{left:number,top:number,width:number,height:number}} selection Bounding rectangle in CSS px.
   */
  async function handleSelection(selection) {
    const t0 = performance.now();
    console.log('[OCR SNIP] Requesting tab capture');
    try {
      const captureResp = await chrome.runtime.sendMessage({ type: MSG.CAPTURE_TAB });
      if (!captureResp?.ok) throw new Error(captureResp?.error || 'Capture failed');
      console.log('[OCR SNIP] Got full screenshot');
      const cropped = await cropDataUrl(captureResp.dataUrl, selection);
      console.log('[OCR SNIP] Cropped image size (dataURL length):', cropped.length);
      ns.overlay.removeOverlayOnly?.();
      const dpr = window.devicePixelRatio || 1;
      if (selection.width * dpr < 50 || selection.height * dpr < 50) {
        showBubble('Selection too small (<50px)', selection.left + selection.width + 8, selection.top, 'Error', true); return;
      }
      showBubble('Processing OCR...', selection.left + selection.width + 8, selection.top, null, false, { spinner: true });
      const tAfterCrop = performance.now();
      const ocrText = await performOcr(cropped);
      if (!ocrText) throw new Error('Empty OCR result');
      console.log('[OCR SNIP] OCR text length:', ocrText.length);
      const tAfterOcr = performance.now();
      const cfg = await ns.getConfig();
      let translated = null;
      if (cfg.autoTranslate) { translated = await ns.translate.maybeTranslate(ocrText); if (translated) console.log('[OCR SNIP] Translation text length:', translated.length); }
      // Always show OCR text first in OCR section
      showBubble(ocrText, selection.left + selection.width + 8, selection.top, 'OCR');
      addActionButtons({ showTranslate: true, originalText: ocrText, preFetchedTranslation: translated });
      chrome.storage.sync.set({ [STORAGE_KEYS.LAST_RESULT]: { ocr: ocrText, translated, ts: Date.now() } });
      const tEnd = performance.now();
      console.log('[OCR SNIP] Timing ms { crop:' + (tAfterCrop - t0).toFixed(1) + ', ocr:' + (tAfterOcr - tAfterCrop).toFixed(1) + ', translate+display:' + (tEnd - tAfterOcr).toFixed(1) + ', total:' + (tEnd - t0).toFixed(1) + ' }');
    } catch (e) {
      console.error('[OCR SNIP] Error during capture/OCR pipeline', e);
      showBubble(String(e), selection.left, selection.top, 'Error', true);
    }
  }

  chrome.runtime.onMessage.addListener((msg) => { if (msg?.type === MSG.START_SELECTION) { console.log('[OCR SNIP] START_SELECTION message received'); ns.overlay.beginSelection(handleSelection); } });
  window.__startOcrSelection = () => ns.overlay.beginSelection(handleSelection);
})(window.__ocrSnip = window.__ocrSnip || {});

