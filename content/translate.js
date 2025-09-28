// translate.js - Translation related functions
(function (ns) {
  if (ns.translate) return;
  async function maybeTranslate(text) {
    const cfg = await ns.getConfig();
    if (!cfg.autoTranslate || !cfg.azureTranslateKey) return null;
    console.log('[OCR SNIP] Performing translation request');
    const endpoint = cfg.azureTranslateEndpoint;
    const processed = cfg.ignoreNewlines ? text.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim() : text;
    const body = [{ Text: processed }];
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
    return json?.[0]?.translations?.[0]?.text || null;
  }

  async function forceTranslate(text) {
    const cfg = await ns.getConfig();
    if (!(cfg.azureTranslateKey && cfg.azureTranslateEndpoint)) return null;
    console.log('[OCR SNIP] Manual translate triggered');
    const processed = cfg.ignoreNewlines ? text.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim() : text;
    const body = [{ Text: processed }];
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

  ns.translate = { maybeTranslate, forceTranslate };
})(window.__ocrSnip = window.__ocrSnip || {});
