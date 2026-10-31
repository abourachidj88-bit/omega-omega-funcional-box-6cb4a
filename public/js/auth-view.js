'use strict';
// ---------- Pantallas de acceso: primer arranque (admin) e ingreso ----------
function pantallaAcceso(estado) {
  const primera = !estado.configurada && !estado.esperando_sync;
  $('#app').innerHTML = `
  <div class="auth"><div class="card">
    ${logoHtml(true)}
    ${estado.esperando_sync ? '<div class="warnbox">La aplicación web todavía no recibió los datos del gimnasio. Pedile al administrador que toque “Sincronizar con la aplicación Web” en la PC y volvé a intentar.</div>' : ''}
    <p class="center muted">${primera ? 'Bienvenido/a. Primero damos de alta tu gimnasio y creamos el usuario del administrador (dueño).' : 'Ingresá con tu usuario y contraseña del gimnasio.'}</p>
    <form id="f-acceso" class="stack" autocomplete="on">
      ${primera ? '<div class="field"><label>Nombre del gimnasio *</label><input name="gimnasio" maxlength="40" placeholder="Ej.: Gimnasio Sol" required autocomplete="organization"></div><div class="field"><label>Logo del gimnasio (opcional)</label><input type="file" id="alta-logo" accept="image/*"><div class="small muted" style="margin-top:4px">También sirve de ícono de la app. Lo podés cambiar después con el lápiz ✎.</div></div>' : ''}
      ${primera ? '<div class="field"><label>Tu nombre</label><input name="nombre" autocomplete="name" placeholder="Nombre y apellido"></div>' : ''}
      <div class="field"><label>Usuario</label><input name="username" autocomplete="username" autocapitalize="none" required></div>
      <div class="field"><label>Contraseña</label><input name="password" type="password" autocomplete="${primera ? 'new-password' : 'current-password'}" required minlength="${primera ? 8 : 1}">
        ${primera ? '<div class="small muted" style="margin-top:4px">Mínimo 8 caracteres. Guardala bien: sos el único administrador.</div>' : ''}</div>
      ${primera ? '<div class="field"><label>Repetí la contraseña</label><input name="password2" type="password" autocomplete="new-password" required></div>' : ''}
      <div class="err" id="acceso-err"></div>
      <button class="primary big" style="width:100%">${primera ? 'Crear administrador' : 'Ingresar'}</button>
    </form>
  ${window.OMEGA_DEMO && !primera ? demoAccesos() : ''}<p class="center small muted" style="margin:14px 0 0">${esc(estado.version || '')}</p></div></div>`;
  $$('[data-demo-user]').forEach(b => b.onclick = () => { const f = $('#f-acceso'); f.username.value = b.dataset.demoUser; f.password.value = b.dataset.demoPass; f.requestSubmit(); });
  $('#f-acceso').onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const err = $('#acceso-err'); err.textContent = '';
    if (primera && f.password !== f.password2) { err.textContent = 'Las contraseñas no coinciden'; return; }
    const btn = $('button', e.target); btn.disabled = true;
    try {
      let logo = null;
      if (primera) { const fl = $('#alta-logo').files[0]; if (fl) logo = await imagenLogo(fl); }
      const r = await api('POST', primera ? '/setup' : '/login', { username: f.username, password: f.password, nombre: f.nombre }, { noRedirect: true });
      guardarSesion(r.token, r.usuario);
      if (primera) {
        // alta del gimnasio: nombre y logo (el ícono de la app sale del logo) y, enseguida, la creación de su aplicación web
        try {
          const body = { nombre: f.gimnasio };
          if (logo) { body.logo = logo; body.icono_fuente = ''; body.iconos = await generarIconos(logo, '#0e1013'); body.tema = { icono_fondo: '#0e1013' }; }
          S.marca = await api('PUT', '/marca', body); aplicarMarca();
        } catch (_) {}
        window.__altaPendiente = true;
      }
      if (!/^\/asistir\//.test(rutaActual())) setRuta('#/'); // el QR del gimnasio vuelve a la pantalla de asistencia después de ingresar
      render();
      if (window.__altaPendiente) { window.__altaPendiente = false; try { const e = await api('GET', '/sync/estado'); if (e.nodo === 'pc' && !e.configurado && !window.OMEGA_DEMO) ofrecerSincronizar(); } catch (_) {} }
    } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
  };
}

function demoAccesos() {
  const cred = window.OMEGA_DEMO.credenciales || [];
  return `<div class="card demo-box"><b>Versión de prueba</b><p class="small muted" style="margin:4px 0 10px">Tocá un perfil para entrar con datos de ejemplo:</p>
    ${cred.map(c => `<button class="demo-cred" data-demo-user="${esc(c.usuario)}" data-demo-pass="${esc(c.clave)}"><span><b>${esc(c.rol)}</b><br><span class="small muted">${esc(c.usuario)} · ${esc(c.clave)}</span></span><span>›</span></button>`).join('')}</div>`;
}

// ---------- Estructura (menú superior, navegación por rol) ----------
// Menú: [prefijo, texto, destino]. El del profesor depende de sus permisos.
function menuDe(rol) {
  if (rol === 'admin') return [['/', 'Inicio', '/'], ['/asistencias', 'Asistencias', '/asistencias'], ['/clientes', 'Clientes', '/clientes'], ['/crm', 'CRM', '/crm'], ['/planificacion', 'Planificación', '/planificacion'], ['/finanzas', 'Finanzas', '/finanzas'], ['/usuarios', 'Usuarios', '/usuarios'], ['/ajustes', 'Ajustes', '/ajustes']];
  if (rol !== 'profesor') return [];
  const primero = (lista) => { const x = lista.find(([, k]) => puede(k)); return x ? x[0] : null; };
  const out = [];
  const add = (pre, txt, dest) => { if (dest) out.push([pre, txt, dest]); };
  add('/', 'Inicio', primero([['/', 'inicio.ver']]));
  add('/asistencias', 'Asistencias', primero([['/asistencias', 'asist.ver'], ['/asistencias/cargar', 'asist.registrar']]));
  add('/clientes', 'Alumnos', primero([['/clientes', 'cli.ver']]));
  add('/crm', 'Visitas', primero([['/crm', 'crm.ver']]));
  add('/planificacion', 'Clases', primero([['/planificacion', 'plan.semana'], ['/planificacion/staff', 'plan.staff'], ['/planificacion/rutinas', 'plan.rutinas'], ['/planificacion/biblioteca', 'plan.biblioteca'], ['/planificacion/formatos', 'plan.semana']]));
  add('/finanzas', puede('fin.analisis|fin.resultados|fin.presupuesto') ? 'Finanzas' : 'Caja', primero([['/finanzas', 'fin.caja'], ['/finanzas/mes', 'fin.analisis'], ['/finanzas/resultados', 'fin.resultados'], ['/finanzas/presupuesto', 'fin.presupuesto']]));
  out.push(['/cuenta', 'Mi cuenta', '/cuenta']);
  return out;
}
function shell(rol, ruta, contenidoHtml) {
  const rolTxt = { admin: 'Administrador', profesor: 'Profesor', cliente: 'Alumno' }[rol];
  document.body.classList.toggle('alumno', rol === 'cliente');
  const nav = menuDe(rol).map(([h, t, d]) => `<a href="#${d}" class="${(h === '/' ? ruta === '/' : ruta.startsWith(h)) ? 'on' : ''}">${t}</a>`).join('');
  const bnav = rol === 'cliente' ? `<div class="bnav">
      <a href="#/" class="${ruta === '/' ? 'on' : ''}"><span class="ico">▦</span>Mi QR</a>
      <a href="#/entrenamiento" class="${ruta.startsWith('/entrenamiento') ? 'on' : ''}"><span class="ico">▶</span>Entrenamiento</a>
      <a href="#/horarios" class="${ruta.startsWith('/horarios') ? 'on' : ''}"><span class="ico">☷</span>Horarios</a>
      <a href="#/perfil" class="${ruta.startsWith('/perfil') ? 'on' : ''}"><span class="ico">☺</span>Mi perfil</a></div>` : '';
  $('#app').innerHTML = `<div class="shell">
    <header class="top"><div class="logo">${logoHtml(false)}${rol === 'admin' ? '<button class="logo-edit" id="btn-logo" title="Cambiar logo, nombre y tipografía" aria-label="Cambiar logo">✎</button>' : ''}${rol === 'admin' || (rol === 'profesor' && puede('cfg.diseno')) ? '<button class="logo-edit" id="btn-diseno" title="Colores, fondo y letras" aria-label="Diseño">🎨</button>' : ''}</div>
      <div class="who"><span class="rol">${rolTxt}</span><span class="hide-sm">${esc(S.user.nombre || S.user.username)}</span>${rol === 'cliente' ? '' : ''}${rol !== 'cliente' ? `<button class="campana" id="btn-notif" title="Avisos" aria-label="Avisos">🔔<span class="badge">0</span></button>` : ''}<button class="ghost sm" id="btn-salir">Salir</button></div></header>
    ${nav ? `<nav class="nav">${nav}</nav>` : ''}
    <main id="main">${contenidoHtml || ''}</main>${bnav}</div>`;
  const bn = $('#btn-notif'); if (bn) { bn.onclick = abrirNotificaciones; actualizarCampana(); }
  const bl = $('#btn-logo'); if (bl) bl.onclick = editarMarca;
  const bd = $('#btn-diseno'); if (bd) bd.onclick = editarDiseno;
  $('#btn-salir').onclick = async () => { if (await confirmar('¿Cerrar sesión en este dispositivo?', 'Salir')) cerrarSesion(); };
  return $('#main');
}
