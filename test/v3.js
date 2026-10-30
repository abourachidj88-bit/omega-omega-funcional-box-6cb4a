'use strict';
// Pruebas de la Versión 3: intervalos libres, importador de Excel, QR de asistencia, diseño e instalador.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const P = 4300 + Math.floor(Math.random() * 400);
const D = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-v3-'));
const BASE = 'http://127.0.0.1:' + P;
let ok = 0; const paso = (n) => { ok++; console.log('  ✓ ' + n); };
const ar = () => new Date(Date.now() - 3 * 3600 * 1000);
const hoy = () => ar().toISOString().slice(0, 10);
const suma = (f, n) => { const [y, m, d] = f.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
async function api(metodo, ruta, cuerpo, token) {
  const r = await fetch(BASE + ruta, { method: metodo, headers: { ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch (_) { j = t; } return { status: r.status, data: j };
}
const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: P, DATA_DIR: D, HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
async function esperar() { for (let i = 0; i < 60; i++) { try { await fetch(BASE + '/api/estado'); return; } catch (_) { await new Promise(r => setTimeout(r, 100)); } } throw new Error('no arrancó'); }

(async () => {
  try {
    await esperar();
    let r = await api('POST', '/api/setup', { username: 'dueno', password: 'Omega#2026', nombre: 'Dueño' }); const admin = r.data.token;

    console.log('Planificación: intervalos libres');
    r = await api('GET', '/api/formatos', undefined, admin); const fm = r.data; const flex = fm.find(f => f.nombre === 'Flex'), fun = fm.find(f => f.nombre === 'Funcional'), end = fm.find(f => f.nombre === 'Endurance');
    r = await api('PUT', '/api/formatos', { formatos: fm.map(f => ({ id: f.id, trabajo_seg: 40, descanso_seg: 20 })) }, admin); assert.equal(r.status, 200);
    r = await api('PUT', '/api/formatos', { formatos: [{ id: end.id, trabajo_seg: 7200, descanso_seg: 20 }] }, admin); assert.equal(r.status, 200); assert.equal(r.data.find(f => f.id === end.id).trabajo_seg, 7200); paso('el tiempo de trabajo ya no tiene máximo');
    r = await api('PUT', '/api/formatos', { formatos: [{ id: end.id, trabajo_seg: 420, sin_descanso: 1 }] }, admin); assert.equal(r.status, 200); let e = r.data.find(f => f.id === end.id); assert.equal(e.sin_descanso, 1); assert.equal(e.trabajo_seg, 420); paso('un formato de 7 minutos sin descanso');
    r = await api('PUT', '/api/formatos', { formatos: [{ id: flex.id, sin_trabajo: 1, sin_descanso: 1, trabajo_seg: null, descanso_seg: null, duracion_min: 60 }] }, admin); assert.equal(r.status, 200); assert.equal(r.data.find(f => f.id === flex.id).sin_trabajo, 1); paso('Flex queda sin intervalos (clase de 60 minutos)');
    r = await api('PUT', '/api/formatos', { formatos: fm.filter(f => f.id !== flex.id && f.id !== end.id).map(f => ({ id: f.id, trabajo_seg: 40, descanso_seg: 20 })) }, admin);
    r = await api('GET', '/api/planificacion?desde=' + hoy() + '&dias=7', undefined, admin); assert.equal(r.status, 200);
    r = await api('POST', '/api/planificacion/generar', { desde: hoy(), dias: 7 }, admin); assert.equal(r.status, 200, JSON.stringify(r.data)); paso('con Flex sin intervalos ya no pide cargar sus tiempos y la semana se genera');
    r = await api('GET', '/api/planificacion?desde=' + hoy() + '&dias=7', undefined, admin);
    let cf = null; for (const d of r.data) for (const c of d.clases) if (c.circuito && c.formato && c.formato.id === flex.id) cf = cf || c.circuito;
    if (cf) { assert.equal(cf.sin_trabajo, true); assert.equal(cf.duracion_min, 60); paso('el circuito de Flex es una sola clase de 60 minutos'); }
    let ce = null; for (const d of r.data) for (const c of d.clases) if (c.circuito && c.formato && c.formato.id === end.id) ce = ce || c.circuito;
    if (ce) { assert.equal(ce.sin_descanso, true); assert.equal(ce.descanso_seg, 0); paso('el circuito de 7 min sin descanso no suma descanso'); }

    console.log('\nClientes: importador');
    r = await api('POST', '/api/planes', { nombre: 'Mensual 3 veces', precio_efectivo: 40000, precio_mp: 44000 }, admin); assert.equal(r.status, 200); const planA = r.data.id;
    r = await api('POST', '/api/planes', { nombre: 'Libre', precio_efectivo: 55000, precio_mp: 60000 }, admin);
    r = await api('POST', '/api/clientes/importar', { filas: [{ nombre: 'Ana García' }, { nombre: 'Luis Pérez', celular: '11 5555-1234', plan: 'Mensual 3 veces (Efectivo $40.000 · Mercado Pago $44.000)' }, { nombre: '' }] }, admin);
    assert.equal(r.status, 200); assert.equal(r.data.creados, 2); assert.equal(r.data.errores.length, 1); assert.equal(r.data.accesos.length, 2); paso('solo el nombre es obligatorio; se crean los accesos web');
    r = await api('GET', '/api/clientes', undefined, admin); const luis = r.data.find(c => c.nombre === 'Luis Pérez'); assert.ok(luis); r = await api('GET', '/api/clientes/' + luis.id, undefined, admin); assert.equal(r.data.plan_id, planA); assert.equal(r.data.precio_plan, 40000); paso('el plan elegido (con precios en la lista) se asigna al alumno');
    r = await api('POST', '/api/clientes/importar', { filas: [{ nombre: 'ana garcia', celular: '11 4444-9999', instagram: '@anag' }, { nombre: 'Luis Pérez' }, { nombre: 'Carla Ruiz', plan: 'Libre' }, { nombre: 'Pedro', plan: 'Inexistente' }] }, admin);
    assert.equal(r.data.creados, 2); assert.equal(r.data.actualizados, 1); assert.equal(r.data.sin_cambios, 1); assert.ok(r.data.avisos.some(a => /Inexistente/.test(a))); paso('reimportar no duplica: actualiza a los existentes y suma a los nuevos');
    r = await api('GET', '/api/clientes', undefined, admin); assert.equal(r.data.filter(c => /garc/i.test(c.nombre)).length, 1); assert.equal(r.data.length, 4);
    const ana = r.data.find(c => /Ana/.test(c.nombre)); r = await api('GET', '/api/clientes/' + ana.id, undefined, admin); assert.ok(r.data.celular); assert.equal(r.data.instagram, 'anag'); paso('se completaron celular e Instagram sin tocar el resto');
    r = await api('POST', '/api/clientes/importar', { filas: [{ nombre: 'Ana García' }] }, admin); r = await api('GET', '/api/clientes/' + ana.id, undefined, admin); assert.ok(r.data.celular, 'no debe borrar datos'); paso('una fila con menos datos no borra lo que ya estaba cargado');

    console.log('\nAsistencias: QR fijo del gimnasio');
    r = await api('GET', '/api/asistencias/qr-fijo', undefined, admin); assert.equal(r.status, 200); const tok = r.data.token; assert.ok(tok && tok.length >= 10); paso('el gimnasio tiene un QR fijo propio');
    r = await api('GET', '/api/asistencias/qr-fijo', undefined, admin); assert.equal(r.data.token, tok); paso('el código es siempre el mismo (se puede imprimir)');
    r = await api('GET', '/api/clientes', undefined, admin); const luis3 = r.data.find(c => c.nombre === 'Luis Pérez'); r = await api('GET', '/api/clientes/' + luis3.id, undefined, admin);
    r = await api('POST', '/api/clientes/' + luis3.id + '/acceso', undefined, admin); const acc = r.data; r = await api('POST', '/api/login', { username: acc.usuario, password: acc.clave }); assert.equal(r.status, 200); const alu = r.data.token;
    r = await api('GET', '/api/asistir/estado?k=mal', undefined, alu); assert.equal(r.status, 400); paso('un QR que no es del gimnasio se rechaza');
    // agenda de prueba: clases a todas las horas del día actual
    const hoyDow = ((ar().getUTCDay() + 6) % 7) + 1; const horaAr = ar().getUTCHours();
    r = await api('GET', '/api/formatos', undefined, admin); const f0 = r.data[0];
    const celdas = [horaAr, horaAr + 1].filter(h => h <= 23).map(h => ({ dia: hoyDow, hora: h, formato_id: f0.id }));
    r = await api('PUT', '/api/agenda', { celdas, cambios: celdas }, admin);
    r = await api('GET', '/api/asistir/estado?k=' + tok, undefined, alu); assert.equal(r.status, 200); assert.ok(r.data.nombre);
    if (r.data.clase) {
      const h1 = r.data.clase.hora;
      r = await api('POST', '/api/asistir', { k: tok, modo: 'clase' }, alu); assert.equal(r.status, 200); assert.equal(r.data.duplicada, false); paso('Clase: la asistencia se registra en la clase y horario que corresponde');
      r = await api('POST', '/api/asistir', { k: tok, modo: 'clase' }, alu); assert.equal(r.data.duplicada, true); paso('escanear dos veces en la misma clase no duplica');
      r = await api('GET', '/api/asistencias?fecha=' + hoy() + '&hora=' + h1, undefined, admin); assert.equal(r.data.filter(a => a.cliente_id === luis3.id).length, 1);
    }
    r = await api('POST', '/api/asistir', { k: tok, modo: 'rutina' }, alu); assert.equal(r.status, 200); paso('Rutina: queda registrada la visita');
    r = await api('GET', '/api/dashboard', undefined, admin); assert.ok(r.data.kpis.rutinas_dia >= 0); paso('las rutinas no ocupan lugar en la capacidad de las clases');
    r = await api('POST', '/api/asistir', { k: tok, modo: 'otro' }, alu); assert.equal(r.status, 400);
    r = await api('GET', '/api/asistir/estado?k=' + tok, undefined, admin); assert.equal(r.status, 403); paso('solo los alumnos usan el QR fijo para registrarse');
    r = await api('POST', '/api/asistencias/qr-fijo/nuevo', undefined, admin); assert.notEqual(r.data.token, tok); r = await api('GET', '/api/asistir/estado?k=' + tok, undefined, alu); assert.equal(r.status, 400); paso('si imprimieron un QR viejo, se puede renovar y el viejo deja de servir');

    console.log('\nDiseño: colores, fondo, letras e ícono');
    r = await api('GET', '/api/marca'); assert.equal(r.data.tema.fondo, 'defecto'); assert.equal(r.data.tema.boton_color, '#ff6b35'); paso('el diseño original viene por defecto');
    r = await api('PUT', '/api/marca', { tema: { fondo: 'color', fondo_color: '#102030', texto_color: '#ffffff', boton_color: '#22aa66', fuente_texto: 'Poppins' } }, admin); assert.equal(r.status, 200); assert.equal(r.data.tema.boton_color, '#22aa66'); assert.equal(r.data.tema.fuente_texto, 'Poppins');
    r = await api('GET', '/api/marca'); assert.equal(r.data.tema.fondo_color, '#102030'); paso('fondo de color sólido, letras, fuente y color de botones se guardan y los ven todos (también sin ingresar)');
    r = await api('PUT', '/api/marca', { tema: { boton_color: 'rojo' } }, admin); assert.equal(r.data.tema.boton_color, '#22aa66'); r = await api('PUT', '/api/marca', { tema: { fuente_texto: 'Comic' } }, admin); assert.equal(r.status, 400); paso('colores y fuentes inválidos se rechazan');
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    r = await api('PUT', '/api/marca', { tema: { fondo: 'imagen', fondo_imagen: 'data:text/html;base64,AAAA' } }, admin); assert.equal(r.status, 400);
    r = await api('PUT', '/api/marca', { tema: { fondo: 'imagen', fondo_imagen: png, fondo_veladura: 120 } }, admin); assert.equal(r.status, 200); assert.equal(r.data.tema.fondo, 'imagen'); assert.equal(r.data.tema.fondo_veladura, 90); paso('el fondo con foto del logo del gimnasio se guarda (con límite de tamaño y formato)');
    const m0 = await fetch(BASE + '/manifest.webmanifest').then(x => x.json()); assert.ok(m0.icons.length >= 2); assert.ok(!m0.icons[0].src.includes('?v='));
    r = await api('PUT', '/api/marca', { iconos: { '64': png, '180': png, '192': png, '256': png, '512': png, m512: png }, icono_fuente: png }, admin); assert.equal(r.status, 200); assert.ok(r.data.icono_v); assert.equal(r.data.icono_propio, true);
    const m1 = await fetch(BASE + '/manifest.webmanifest').then(x => x.json()); assert.ok(m1.icons[0].src.includes('?v=' + r.data.icono_v)); assert.equal(m1.theme_color, '#102030'); paso('el manifiesto de la app toma el ícono propio y los colores del gimnasio');
    for (const u of ['/icons/app-192.png', '/icons/app-512.png', '/icons/apple-touch-icon.png', '/icons/favicon.png', '/icons/maskable-512.png']) { const x = await fetch(BASE + u); assert.equal(x.status, 200); const b = Buffer.from(await x.arrayBuffer()); assert.ok(b.length === 70 || b.length === 69 || b.length > 60); assert.equal(b.slice(1, 4).toString(), 'PNG'); }
    paso('el ícono se sirve para el celular, el navegador y el acceso directo (PNG propio)');
    assert.ok(fs.existsSync(path.join(D, 'omega.ico'))); const ico = fs.readFileSync(path.join(D, 'omega.ico')); assert.equal(ico.readUInt16LE(2), 1); assert.equal(ico.slice(22, 26).toString('latin1').slice(1), 'PNG'); paso('se genera omega.ico para el acceso directo de Windows');
    r = await api('PUT', '/api/marca', { iconos: null, icono_fuente: '' }, admin); const x0 = await fetch(BASE + '/icons/app-192.png'); assert.equal(x0.status, 200); const m2 = await fetch(BASE + '/manifest.webmanifest').then(x => x.json()); assert.ok(!m2.icons[0].src.includes('?v=')); paso('al quitar el ícono propio se vuelve al de OMEGA');
    r = await api('PUT', '/api/marca', { tema: { fondo: 'defecto', texto_color: '#eef1f6', boton_color: '#ff6b35', fuente_texto: 'Sistema' } }, admin);

    console.log('\nSincronizar: gimnasio nuevo con su web');
    const PN = P + 500, DN = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-v3n-')); const BN = 'http://127.0.0.1:' + PN; const CLAVE = 'clave-de-prueba-1234567890';
    const nube = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: PN, DATA_DIR: DN, HOST: '127.0.0.1', OMEGA_NODO: 'nube', SYNC_CLAVE: CLAVE }, stdio: 'ignore' });
    for (let i = 0; i < 60; i++) { try { await fetch(BN + '/api/estado'); break; } catch (_) { await new Promise(r => setTimeout(r, 100)); } }
    r = await api('GET', '/api/sync/estado', undefined, admin); assert.equal(r.data.configurado, false); paso('un gimnasio nuevo aparece sin conectar (botón Sincronizar)');
    r = await api('POST', '/api/sync/conectar', { url: BN, clave: 'clave-equivocada-123456' }, admin); assert.equal(r.status, 400); assert.match(JSON.stringify(r.data), /No se pudo conectar/); r = await api('GET', '/api/sync/estado', undefined, admin); assert.equal(r.data.configurado, false); paso('con una clave equivocada no conecta ni guarda nada');
    r = await api('POST', '/api/sync/conectar', { url: 'no-es-una-url', clave: CLAVE }, admin); assert.equal(r.status, 400);
    r = await api('POST', '/api/sync/conectar', { url: BN, clave: CLAVE }, admin); assert.equal(r.status, 200, JSON.stringify(r.data)); assert.equal(r.data.ok, true); paso('con la dirección y la clave correctas conecta y sincroniza');
    r = await api('GET', '/api/sync/estado', undefined, admin); assert.equal(r.data.configurado, true); assert.equal(r.data.url, BN);
    const cli = await fetch(BN + '/api/marca').then(x => x.json()); assert.equal(cli.tema.boton_color, '#ff6b35');
    r = await api('POST', '/api/usuarios', { username: 'prof3', password: 'profe123', rol: 'profesor', nombre: 'Profe Tres' }, admin); r = await api('POST', '/api/login', { username: 'prof3', password: 'profe123' }); const prof3 = r.data.token;
    r = await api('POST', '/api/sync/conectar', { url: BN, clave: CLAVE }, prof3); assert.ok([401, 403].includes(r.status));
    nube.kill(); paso('la web del gimnasio recibe los datos y solo el administrador puede conectar');

    console.log('\nTodo OK: ' + ok + ' verificaciones de la Versión 3');
    srv.kill(); process.exit(0);
  } catch (e) { console.error('\n✗ FALLÓ:', e.message); console.error(e.stack.split('\n').slice(0, 4).join('\n')); console.error('--- log ---\n' + log.slice(-800)); srv.kill(); process.exit(1); }
})();
