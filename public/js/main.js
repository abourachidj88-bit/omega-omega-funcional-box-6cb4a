'use strict';
// ---------- Router y arranque ----------
let renderId = 0;
async function render() {
  const mi = ++renderId;
  stopTimers();
  cerrarModales();
  try {
    const estado = await api('GET', '/estado', undefined, { noRedirect: true });
    if (!S.marcaCargada) { S.marcaCargada = true; await cargarMarca(); }
    if (rutaActual() === '/visita') return pantallaVisita();
    if (!S.token) return pantallaAcceso(estado);
    if (!S.user) {
      try { S.user = await api('GET', '/yo', undefined, { noRedirect: true }); }
      catch (_) { S.token = null; try { localStorage.removeItem('omega_token'); } catch (__) {} return pantallaAcceso(estado); }
    }
    else if (S.user.rol === 'profesor') { try { S.user = await api('GET', '/yo', undefined, { noRedirect: true }); } catch (_) {} } // toma los permisos vigentes
    if (!S.pais) await cargarPais();
    if (mi !== renderId) return;
    const ruta = rutaActual();
    for (const v of VISTAS) {
      const m = v.rx.exec(ruta);
      if (!m || !v.roles.includes(S.user.rol)) continue;
      if (v.perm && S.user.rol === 'profesor' && !puede(v.perm)) continue;
      const params = {}; v.keys.forEach((k, i) => params[k] = decodeURIComponent(m[i + 1]));
      const main = shell(S.user.rol, ruta, '<div class="empty"><span class="spinner"></span></div>');
      await v.fn(main, params);
      if (S.user.rol === 'cliente') setTimeout(bannerInstalar, 1200);
      return;
    }
    if (S.user.rol === 'profesor' && ruta === '/') { const p = menuDe('profesor')[0]; if (p && p[2] !== '/') return ir('#' + p[2]); }
    ir('#/');
    if (ruta !== '/') return; // evita bucles
    shell(S.user.rol, '/', '<div class="empty">Pantalla no disponible para tu usuario.</div>');
  } catch (e) {
    if (mi !== renderId) return;
    $('#app').innerHTML = `<div class="auth"><div class="card center"><h2>No se pudo conectar</h2><p class="muted">${esc(e.message)}</p><button class="primary" onclick="render()">Reintentar</button></div></div>`;
  }
}
window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { if (!window.OMEGA_DEMO) navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}
