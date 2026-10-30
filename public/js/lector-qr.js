'use strict';
// Lector de QR con cámara. Más robusto que la versión anterior:
//  1) usa el detector nativo del navegador (BarcodeDetector) cuando existe: lee QR en pantallas de celular con brillo, reflejos y muaré;
//  2) si no existe, usa jsQR con varios intentos por cuadro (cuadro completo, recorte central ampliado, contraste reforzado y colores invertidos);
//  3) pide a la cámara más resolución y enfoque continuo, deja elegir la cámara y prender la linterna.
const LectorQR = (() => {
  let detectorNativo;
  async function nativo() {
    if (detectorNativo !== undefined) return detectorNativo;
    detectorNativo = null;
    try {
      if ('BarcodeDetector' in window) {
        const f = await BarcodeDetector.getSupportedFormats();
        if (f.includes('qr_code')) detectorNativo = new BarcodeDetector({ formats: ['qr_code'] });
      }
    } catch (_) { detectorNativo = null; }
    return detectorNativo;
  }
  // ----- decodificación de un cuadro (video, imagen o canvas). Devuelve el texto o null.
  const lienzo = document.createElement('canvas');
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  function dibujar(fuente, sx, sy, sw, sh, ancho) {
    const k = ancho / sw; lienzo.width = Math.round(ancho); lienzo.height = Math.max(1, Math.round(sh * k));
    ctx.imageSmoothingEnabled = true; ctx.drawImage(fuente, sx, sy, sw, sh, 0, 0, lienzo.width, lienzo.height);
    return ctx.getImageData(0, 0, lienzo.width, lienzo.height);
  }
  function reforzar(img) { // escala de grises con el contraste estirado (ayuda con reflejos y pantallas de poco brillo)
    const d = img.data; let mn = 255, mx = 0;
    for (let i = 0; i < d.length; i += 4) { const g = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8; d[i] = g; if (g < mn) mn = g; if (g > mx) mx = g; }
    const r = Math.max(30, mx - mn);
    for (let i = 0; i < d.length; i += 4) { const g = Math.max(0, Math.min(255, ((d[i] - mn) * 255) / r)); d[i] = d[i + 1] = d[i + 2] = g; }
    return img;
  }
  function conJsQR(img) { const r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' }); return r ? r.data : null; }
  let ciclo = 0;
  async function decodificar(fuente, w, h, completo) {
    const nat = await nativo();
    if (nat) { try { const r = await nat.detect(fuente); if (r && r.length) return r[0].rawValue; } catch (_) {} }
    if (typeof jsQR !== 'function') return null;
    const intentos = completo ? [0, 1, 2, 3] : [ciclo++ % 4];
    for (const n of intentos) {
      let img;
      if (n === 0) img = dibujar(fuente, 0, 0, w, h, Math.min(w, 1000));                                   // cuadro completo
      else if (n === 1) img = dibujar(fuente, w * 0.15, h * 0.15, w * 0.7, h * 0.7, Math.min(w * 0.7, 800)); // centro ampliado
      else if (n === 2) img = reforzar(dibujar(fuente, 0, 0, w, h, Math.min(w, 800)));                       // contraste reforzado
      else img = reforzar(dibujar(fuente, w * 0.2, h * 0.2, w * 0.6, h * 0.6, Math.min(w * 0.6, 640)));
      const t = conJsQR(img); if (t) return t;
    }
    return null;
  }
  // Lee un QR de una foto (archivo): prueba a varios tamaños
  async function deImagen(img) {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const nat = await nativo();
    if (nat) { try { const r = await nat.detect(img); if (r && r.length) return r[0].rawValue; } catch (_) {} }
    for (const maximo of [1600, 1000, 640]) {
      const k = Math.min(1, maximo / Math.max(w, h));
      const t = await decodificar(img, Math.round(w * k), Math.round(h * k), true);
      if (t) return t;
    }
    return null;
  }
  // ----- cámara en vivo
  async function iniciar(video, alLeer, opciones = {}) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw Object.assign(new Error('sin_camara'), { name: 'SinCamara' });
    const base = { width: { ideal: 1920 }, height: { ideal: 1080 } };
    const video_ = opciones.deviceId ? { ...base, deviceId: { exact: opciones.deviceId } } : { ...base, facingMode: { ideal: 'environment' } };
    const stream = await navigator.mediaDevices.getUserMedia({ video: video_, audio: false });
    video.srcObject = stream; video.setAttribute('playsinline', ''); video.muted = true; await video.play();
    const pista = stream.getVideoTracks()[0];
    try { // enfoque continuo si la cámara lo permite
      const cap = pista.getCapabilities ? pista.getCapabilities() : {};
      const adv = [];
      if (cap.focusMode && cap.focusMode.includes('continuous')) adv.push({ focusMode: 'continuous' });
      if (adv.length) await pista.applyConstraints({ advanced: adv });
    } catch (_) {}
    let vivo = true, ocupado = false, ultimoCuadro = 0;
    const tick = async () => {
      if (!vivo) return;
      if (!ocupado && video.readyState >= 2 && video.videoWidth) {
        ocupado = true;
        try { const t = await decodificar(video, video.videoWidth, video.videoHeight, false); if (t) alLeer(t); } catch (_) {}
        ocupado = false;
      }
      setTimeout(tick, 90);
    };
    tick();
    const camaras = async () => { try { return (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput'); } catch (_) { return []; } };
    const linterna = async (on) => { try { await pista.applyConstraints({ advanced: [{ torch: !!on }] }); return true; } catch (_) { return false; } };
    const hayLinterna = () => { try { return !!(pista.getCapabilities && pista.getCapabilities().torch); } catch (_) { return false; } };
    const detener = () => { vivo = false; try { stream.getTracks().forEach(t => t.stop()); } catch (_) {} video.srcObject = null; };
    return { detener, camaras, linterna, hayLinterna, nativo: !!(await nativo()), etiqueta: pista.label || '' };
  }
  return { iniciar, deImagen, decodificar };
})();
