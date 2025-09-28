// ocr.js - OCR & image cropping helpers
(function (ns) {
  if (ns.ocr) return;
  async function cropDataUrl(dataUrl, { left, top, width, height }) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scaleX = window.devicePixelRatio || 1;
        const scaleY = window.devicePixelRatio || 1;
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
    const cfg = await ns.getConfig();
    if (!(cfg.azureVisionKey && cfg.azureVisionEndpoint)) throw new Error('Azure Vision not configured (endpoint/key required)');
    console.log('[OCR SNIP] Using Azure Vision OCR');
    return await azureVisionOcr(croppedDataUrl, cfg);
  }

  async function azureVisionOcr(croppedDataUrl, cfg) {
    const endpoint = cfg.azureVisionEndpoint.replace(/\/$/, '');
    const modelParam = cfg.azureVisionReadModel || 'latest';
    const url = `${endpoint}/computervision/imageanalysis:analyze?api-version=2024-02-01&features=read&model-version=${encodeURIComponent(modelParam)}`;
    const base64 = croppedDataUrl.split(',')[1];
    const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    console.log('[OCR SNIP] Vision request bytes', binary.length);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': cfg.azureVisionKey, 'Content-Type': 'application/octet-stream' },
      body: binary
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error('Vision HTTP ' + res.status + ' ' + txt.slice(0, 200));
    }
    const json = await res.json();
    const collected = [];
    const pushLines = (arr, keyText, keyContent) => {
      arr?.forEach(l => {
        const text = l[keyText] || l[keyContent] || '';
        if (!text) return;
        let box = l.boundingBox || l.polygon;
        let minX = 0, maxX = 0, minY = 0, maxY = 0;
        if (Array.isArray(box) && box.length >= 8) {
          for (let i = 0; i < box.length; i += 2) {
            const x = box[i], y = box[i + 1];
            if (i === 0) { minX = maxX = x; minY = maxY = y; } else { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
          }
        } else if (box?.x !== undefined) {
          minX = box.x; minY = box.y; maxX = minX + (box.w || box.width || 0); maxY = minY + (box.h || box.height || 0);
        }
        collected.push({ text, minX, maxX, minY, maxY });
      });
    };
    if (json.readResult?.blocks?.length) json.readResult.blocks.forEach(b => pushLines(b.lines, 'text', 'content'));
    if (!collected.length && json.readResult?.pages?.length) json.readResult.pages.forEach(p => pushLines(p.lines, 'content', 'text'));
    if (!collected.length && typeof json.readResult?.content === 'string') collected.push({ text: json.readResult.content });
    if (!collected.length && json.readResult?.blocks?.[0]?.lines?.[0]?.text) collected.push({ text: json.readResult.blocks[0].lines[0].text });
    if (!collected.length) return '';
    return collected.map(l => l.text).reverse().map(s => s.trim()).filter(Boolean).join('\n');
  }

  ns.ocr = { cropDataUrl, performOcr };
})(window.__ocrSnip = window.__ocrSnip || {});
