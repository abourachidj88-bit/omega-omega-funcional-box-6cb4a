'use strict';
// Versión de prueba: la app corre entera en el navegador (mismo código que el servidor).
// La base de datos (SQLite) se guarda en este navegador (IndexedDB); los videos también.
(function () {
  const D = window.OMEGA_DEMO = { rutaEnMemoria: true, credenciales: [], videos: new Map() };
  let SQL = null, be = null, api = null, dbm = null, estaPersistiendo = false;

  // ---- almacenamiento local (IndexedDB), tolerante a fallos
  let _idb = null;
  function abrir() {
    if (_idb) return _idb;
    _idb = new Promise((res) => {
      try {
        const r = indexedDB.open('omega-prueba', 1);
        r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('videos'); };
        r.onsuccess = () => res(r.result);
        r.onerror = () => res(null); r.onblocked = () => res(null);
      } catch (_) { res(null); }
    });
    return _idb;
  }
  async function tx(store, modo, fn) {
    const d = await abrir(); if (!d) return undefined;
    return new Promise((res) => {
      try { const t = d.transaction(store, modo); const out = fn(t.objectStore(store)); t.oncomplete = () => res(out && out.result !== undefined ? out.result : undefined); t.onerror = t.onabort = () => res(undefined); } catch (_) { res(undefined); }
    });
  }
  const kvGet = (k) => tx('kv', 'readonly', s => s.get(k));
  const kvPut = (k, v) => tx('kv', 'readwrite', s => s.put(v, k));
  const vPut = (k, v) => tx('videos', 'readwrite', s => s.put(v, k));
  const vTodos = async () => { const d = await abrir(); if (!d) return []; return new Promise((res) => { try { const out = []; const r = d.transaction('videos', 'readonly').objectStore('videos').openCursor(); r.onsuccess = () => { const c = r.result; if (c) { out.push([c.key, c.value]); c.continue(); } else res(out); }; r.onerror = () => res(out); } catch (_) { res([]); } }); };
  const vVaciar = () => tx('videos', 'readwrite', s => s.clear());

  let pendiente = null;
  function programarGuardado() { clearTimeout(pendiente); pendiente = setTimeout(guardar, 600); }
  async function guardar() {
    if (!dbm || estaPersistiendo) return; estaPersistiendo = true;
    try { await kvPut('db', dbm.db.exportar()); } catch (_) {} finally { estaPersistiendo = false; }
  }
  window.addEventListener('pagehide', () => { clearTimeout(pendiente); guardar(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimeout(pendiente); guardar(); } });

  // ---- arranque del "servidor" dentro del navegador
  async function arrancar(modo) {
    if (!SQL) SQL = await initSqlJs();
    let bytes = null;
    if (modo === 'inicio') bytes = (await kvGet('db')) || null;
    globalThis.__OMEGA_SQL = SQL; globalThis.__OMEGA_DBBYTES = bytes;
    be = OMEGA_BACKEND();
    dbm = be.require('src/db.js');
    globalThis.__OMEGA_EXPORTAR = () => dbm.db.exportar();
    api = be.require('src/api.js');
    const demo = be.require('src/demo-data.js');
    D.credenciales = demo.CREDENCIALES;
    registrarRutasDeVideo();
    if (!bytes && modo !== 'vacio') demo.cargarDemo();
    D.modo = modo === 'vacio' ? 'vacio' : 'ejemplo';
    // videos subidos antes
    D.videos.forEach(u => { try { URL.revokeObjectURL(u); } catch (_) {} }); D.videos.clear();
    if (modo === 'inicio') for (const [k, blob] of await vTodos()) D.videos.set(k, URL.createObjectURL(blob));
    await guardar();
  }
  function registrarRutasDeVideo() {
    api.route('DELETE', '/api/ejercicios/:id/video', api.STAFF, ({ params }) => {
      const e = dbm.get('SELECT * FROM ejercicios WHERE id = ?', Number(params.id));
      if (!e) throw new api.HttpError(404, 'Ejercicio no encontrado');
      dbm.run('UPDATE ejercicios SET video = NULL WHERE id = ?', e.id);
      return { ok: true };
    });
  }

  D.fetch = async function (url, opts) {
    opts = opts || {};
    await D.ready;
    const u = new URL(url, 'http://omega.local');
    const headers = {}; for (const k in (opts.headers || {})) headers[k.toLowerCase()] = opts.headers[k];
    const metodo = (opts.method || 'GET').toUpperCase();
    const req = { method: metodo, headers, readJson: async () => (opts.body ? JSON.parse(opts.body) : {}) };
    const out = await api.dispatch(req, decodeURIComponent(u.pathname), Object.fromEntries(u.searchParams));
    if (metodo !== 'GET') programarGuardado();
    return { ok: out.status < 400, status: out.status, json: async () => out.body };
  };

  D.subirVideo = async function (ejId, file, onProgress) {
    if (!/^video\//.test(file.type) && !/\.(mp4|webm|mov|m4v)$/i.test(file.name)) throw new Error('Elegí un archivo de video (mp4, webm o mov)');
    if (file.size > 200 * 1024 * 1024) throw new Error('En la versión de prueba el video puede pesar hasta 200 MB');
    const clave = 'ej' + ejId + '-' + Date.now();
    await vPut(clave, file);
    D.videos.set(clave, URL.createObjectURL(file));
    dbm.run('UPDATE ejercicios SET video = ? WHERE id = ?', 'demo-video:' + clave, Number(ejId));
    programarGuardado();
    if (onProgress) onProgress(100);
    return { video: 'demo-video:' + clave, bytes: file.size };
  };
  D.urlVideo = (v) => (typeof v === 'string' && v.startsWith('demo-video:') ? (D.videos.get(v.slice(11)) || '') : v);

  D.descargar = async function (nombre, blob) {
    try {
      const c = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
      if (c) { await c.save({ filename: nombre, data: blob }); return; }
    } catch (e) { if (e && e.code === 'declined') return; if (e && e.code) { toast('No se pudo guardar el archivo (' + e.code + ')', 'warn'); return; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  D.reiniciar = async function (modo) {
    clearTimeout(pendiente);
    D.ready = arrancar(modo);
    if (modo !== 'inicio') await vVaciar();
    await D.ready;
    cerrarSesion();
  };

  // la ruta vive en memoria: los enlaces "#/..." se resuelven dentro de la página
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#/"]');
    if (a) { e.preventDefault(); ir(a.getAttribute('href')); }
  });

  // barra superior de la versión de prueba
  function barra() {
    const b = document.createElement('div'); b.id = 'demo-bar';
    b.innerHTML = '<span>Versión de prueba · los datos se guardan solo en este navegador</span><span class="acciones"><button id="demo-reset">Restablecer ejemplo</button><button id="demo-vacio">Empezar de cero</button></span>';
    document.body.insertBefore(b, document.getElementById('app'));
    document.getElementById('demo-reset').onclick = async () => { if (await confirmar('Se borra todo lo que cargaste y vuelven los datos de ejemplo.', 'Restablecer', true)) { await D.reiniciar('demo'); toast('Datos de ejemplo restablecidos'); } };
    document.getElementById('demo-vacio').onclick = async () => { if (await confirmar('Se borran todos los datos y la app queda como recién instalada: vas a crear el usuario administrador (primer acceso).', 'Empezar de cero', true)) { await D.reiniciar('vacio'); toast('Base vacía: creá el administrador'); } };
  }
  barra();

  D.ready = arrancar('inicio');
  D.ready.catch((e) => { const app = document.getElementById('app'); if (app) app.innerHTML = '<div class="auth"><div class="card"><h2>No se pudo iniciar la versión de prueba</h2><p class="muted">' + String(e && e.message || e) + '</p></div></div>'; console.error(e); });
})();
