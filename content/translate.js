// translate.js - Translation related functions
(function (ns) {
  if (ns.translate) return;
  async function maybeTranslate(text) {
    const cfg = await ns.getConfig();
    if (!cfg.autoTranslate) return null;
    return await performTranslate(cfg, text, false);
  }

  async function forceTranslate(text) {
    const cfg = await ns.getConfig();
    return await performTranslate(cfg, text, true);
  }

  async function performTranslate(cfg, text, isManual) {
    try {
      const provider = cfg.translationProvider || 'azure';
      const processed = cfg.ignoreNewlines ? text.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim() : text;
      if (!processed) return null;
      if (provider === 'google') {
        if (!cfg.googleTranslateApiKey) {
          if (isManual) console.warn('[OCR SNIP] Google Translate provider selected but API key missing');
          return null;
        }
        // Google Translate API v2 endpoint
        const target = 'en'; // TODO: make target language configurable later
        const url = 'https://translation.googleapis.com/language/translate/v2?key=' + encodeURIComponent(cfg.googleTranslateApiKey);
        const body = { q: processed, target, format: 'text' };
        console.log('[OCR SNIP] Performing Google translation request');
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=UTF-8' },
          body: JSON.stringify(body)
        });
        if (!res.ok) {
          if (isManual) console.error('[OCR SNIP] Google translate request failed', res.status);
          return null;
        }
        const json = await res.json();
        return json?.data?.translations?.[0]?.translatedText || null;
      } else { // Azure default
        if (!(cfg.azureTranslateKey && cfg.azureTranslateEndpoint)) {
          if (isManual) console.warn('[OCR SNIP] Azure translation not configured');
          return null;
        }
        console.log('[OCR SNIP] Performing Azure translation request');
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
    } catch (e) {
      if (isManual) console.error('[OCR SNIP] Translation error', e);
      return null;
    }
  }

  ns.translate = { maybeTranslate, forceTranslate };
})(window.__ocrSnip = window.__ocrSnip || {});
