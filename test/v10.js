'use strict';
// Pruebas de la Versión 10 (se amplía a medida que se suman los puntos).
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const P = 6700 + Math.floor(Math.random() * 400);
const D = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-v10-'));
const BASE = 'http://127.0.0.1:' + P;
let ok = 0; const paso = (n) => { ok++; console.log('  ✓ ' + n); };
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
    r = await api('GET', '/api/estado'); assert.match(r.data.version, /Versión 11/); paso('la app informa Versión 11');

    console.log('1) Baja vacía = fecha de alta');
    r = await api('POST', '/api/clientes', { nombre: 'Ana Prueba', fecha_alta: '2026-11-01' }, admin); assert.equal(r.status, 200, JSON.stringify(r.data));
    const id = r.data.id; r = await api('GET', '/api/clientes/' + id, undefined, admin);
    assert.equal(r.data.fecha_baja, '2026-11-01'); paso('alta manual sin baja: baja = alta');
    r = await api('PUT', '/api/clientes/' + id, { nombre: 'Ana Prueba', fecha_alta: '2026-11-03', fecha_baja: '' }, admin); assert.equal(r.status, 200, JSON.stringify(r.data));
    r = await api('GET', '/api/clientes/' + id, undefined, admin); assert.equal(r.data.fecha_baja, '2026-11-03'); paso('edición con baja vacía: baja = alta');
    r = await api('POST', '/api/clientes/importar', { filas: [{ nombre: 'Beto Importado', fecha_alta: '02/11/2026' }, { nombre: 'Caro Con Baja', fecha_alta: '02/11/2026', fecha_baja: '02/12/2026' }] }, admin);
    assert.equal(r.status, 200, JSON.stringify(r.data));
    r = await api('GET', '/api/clientes', undefined, admin); const L = Array.isArray(r.data) ? r.data : r.data.clientes;
    assert.equal(L.find(c => c.nombre === 'Beto Importado').fecha_baja, '2026-11-02'); assert.equal(L.find(c => c.nombre === 'Caro Con Baja').fecha_baja, '2026-12-02'); paso('importador: baja vacía = alta; baja escrita se respeta');

    console.log('2) Seguridad: preguntas y recuperar la clave');
    r = await api('GET', '/api/recuperar/preguntas'); assert.equal(r.data.configurada, false); paso('sin configurar: avisa');
    r = await api('POST', '/api/recuperar/reset', { username: 'dueno', respuestas: [], nueva: 'NuevaClave#1' }); assert.equal(r.status, 400); paso('sin configurar: no resetea');
    r = await api('GET', '/api/seguridad', undefined, admin); assert.ok(r.data.catalogo.length >= 8); const cat = r.data.catalogo;
    const elegir = (i, ok = true) => ({ id: cat[i].id, respuesta: cat[i].opciones[ok ? 0 : 1] });
    r = await api('PUT', '/api/seguridad', { clave_actual: 'mala', preguntas: [elegir(0), elegir(1), elegir(2)] }, admin); assert.equal(r.status, 400); paso('pide la contraseña actual');
    r = await api('PUT', '/api/seguridad', { clave_actual: 'Omega#2026', preguntas: [elegir(0), elegir(0), elegir(2)] }, admin); assert.equal(r.status, 400); paso('no acepta preguntas repetidas');
    r = await api('PUT', '/api/seguridad', { clave_actual: 'Omega#2026', preguntas: [elegir(0), elegir(1)] }, admin); assert.equal(r.status, 400); paso('exige 3 preguntas');
    r = await api('PUT', '/api/seguridad', { clave_actual: 'Omega#2026', preguntas: [elegir(0), elegir(1), elegir(2)] }, admin); assert.equal(r.status, 200, JSON.stringify(r.data)); paso('guarda 3 preguntas');
    assert.ok(!JSON.stringify((await api('GET', '/api/seguridad', undefined, admin)).data).includes('hash')); paso('la API nunca devuelve las respuestas');
    r = await api('GET', '/api/recuperar/preguntas'); assert.equal(r.data.preguntas.length, 3); assert.ok(!JSON.stringify(r.data).includes('r1$')); paso('pantalla de ingreso: 3 preguntas con opciones');
    const bien = [elegir(0), elegir(1), elegir(2)];
    r = await api('POST', '/api/recuperar/reset', { username: 'dueno', respuestas: [bien[0], bien[1], elegir(2, false)], nueva: 'NuevaClave#1' }); assert.equal(r.status, 401); paso('2 de 3 correctas: no resetea');
    r = await api('POST', '/api/recuperar/reset', { username: 'otro', respuestas: bien, nueva: 'NuevaClave#1' }); assert.equal(r.status, 401); paso('usuario inexistente: no resetea');
    r = await api('POST', '/api/recuperar/reset', { username: 'dueno', respuestas: bien, nueva: 'corta' }); assert.equal(r.status, 400); paso('clave nueva de menos de 8: rechazada');
    r = await api('POST', '/api/recuperar/reset', { username: 'dueno', respuestas: bien, nueva: 'NuevaClave#1' }); assert.equal(r.status, 200, JSON.stringify(r.data));
    r = await api('POST', '/api/login', { username: 'dueno', password: 'NuevaClave#1' }); assert.equal(r.status, 200); paso('3 correctas: clave cambiada y ya ingresa');
    r = await api('POST', '/api/login', { username: 'dueno', password: 'Omega#2026' }); assert.equal(r.status, 401); paso('la clave vieja deja de funcionar');
    for (let i = 0; i < 5; i++) await api('POST', '/api/recuperar/reset', { username: 'dueno', respuestas: [elegir(0, false), elegir(1, false), elegir(2, false)], nueva: 'OtraClave#99' });
    r = await api('POST', '/api/recuperar/reset', { username: 'dueno', respuestas: bien, nueva: 'OtraClave#99' }); assert.equal(r.status, 429); paso('5 fallos: se bloquea 30 minutos (aunque acierte)');
    r = await api('GET', '/api/recuperar/preguntas'); assert.ok(r.data.bloqueado_min > 0); paso('el bloqueo se informa en pantalla');

    console.log('3-4) Equipamiento con dibujo y tamaño en las posiciones');
    const dib = { v: 1, agarre: 1, formas: [{ t: 'r', x: 10, y: 15, w: 30, h: 10, c: '#4da3ff', g: 2.5, f: 1 }, { t: 'a', x: 25, y: 15, rx: 10, ry: 8, c: '#ff8a3d', g: 2.5 }, { t: 'p', pts: [[1, 1], [5, 9], [9, 3]], c: '#e5e7eb', g: 1.5 }] };
    r = await api('POST', '/api/equipamiento', { nombre: 'Cintas TRX', cantidad: 6, dibujo: dib }, admin); assert.equal(r.status, 200, JSON.stringify(r.data)); const clave = r.data.clave;
    r = await api('GET', '/api/equipamiento', undefined, admin); const eqx = r.data.find(e => e.clave === clave); assert.ok(eqx.dibujo && JSON.parse(eqx.dibujo).formas.length === 3); paso('equipamiento nuevo guarda su dibujo');
    r = await api('POST', '/api/equipamiento', { nombre: 'Aro roto', cantidad: 1, dibujo: { formas: [{ t: 'x' }] } }, admin); assert.equal(r.status, 400); paso('dibujo con forma inválida: rechazado');
    r = await api('PUT', '/api/equipamiento/mancuerna', { dibujo: dib }, admin); assert.equal(r.status, 200); paso('se puede redibujar un equipo existente');
    r = await api('PUT', '/api/equipamiento/mancuerna', { dibujo: null }, admin); r = await api('GET', '/api/equipamiento', undefined, admin); assert.ok(!r.data.find(e => e.clave === 'mancuerna').dibujo); paso('quitar el dibujo vuelve al original');
    const pose = (eq) => ({ t: 90, a: [90, 90], l: [90, 90], hx: 100, hy: 80, eq });
    const poses = { v: 1, poses: [pose([{ k: clave, x: 100, y: 80, m: 1, s: 1.8 }]), pose([{ k: 'mancuerna', x: 90, y: 70, m: 0, s: 0.5 }]), pose([])] };
    r = await api('POST', '/api/ejercicios', { nombre: 'Remo con cintas', zona: 'Tirar / Traccionar (Pull)', prog2: 'Remo 2', prog3: 'Remo 3', equipo: clave, patron: 'tirar', poses, img1: null }, admin); assert.equal(r.status, 200, JSON.stringify(r.data));
    r = await api('GET', '/api/ejercicios/' + r.data.id, undefined, admin); const g = JSON.parse(r.data.poses || (r.data.ejercicio && r.data.ejercicio.poses) || '{}');
    assert.equal(g.poses[0].eq[0].k, clave); assert.equal(g.poses[0].eq[0].s, 1.8); assert.equal(g.poses[1].eq[0].s, 0.5); paso('las posiciones guardan el equipo propio y su tamaño');
    r = await api('POST', '/api/ejercicios', { nombre: 'Tamaño loco', zona: 'Tirar / Traccionar (Pull)', prog2: 'a', prog3: 'b', equipo: 'ninguno', patron: 'tirar', poses: { v: 1, poses: [pose([{ k: 'mancuerna', x: 1, y: 1, s: 9 }]), pose([]), pose([])] } }, admin); assert.equal(r.status, 400); paso('tamaño fuera de rango: rechazado');

    console.log('5) Frecuencia semanal por estímulo (reparto en los días de la semana)');
    process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'omega-v10u-'));
    const planner = require('../src/planner'); const est = require('../src/estimulos');
    const CL = est.CLAVES.patrones; const semanaIni = '2026-11-02';
    const dia = (f, n) => planner.repartirFrecuencias(CL, f, 5, semanaIni, null, null);
    let fr = { empujar: 3, tirar: 3, sentadilla: 2, bisagra_cadera: 2, bisagra_rodilla: 1, rotacion: 2, locomocion: 2 }; // suma 15 de 15
    let dias = dia(fr);
    const veces = (c) => dias.filter(l => l.includes(c)).length;
    assert.equal(veces('empujar'), 3); assert.equal(veces('tirar'), 3); assert.equal(veces('rotacion'), 2); assert.equal(veces('locomocion'), 2); assert.equal(veces('sentadilla'), 2); assert.equal(veces('bisagra_rodilla'), 1);
    assert.ok(dias.every(l => l.length === 5)); assert.ok(dias.every(l => new Set(l).size === l.length)); paso('las frecuencias pedidas se cumplen y cada día tiene sus 5 estaciones sin repetir');
    fr = { empujar: 0, tirar: 3, sentadilla: 3, bisagra_cadera: 3, bisagra_rodilla: 2, rotacion: 2, locomocion: 2 }; dias = dia(fr);
    assert.equal(veces('empujar'), 0); assert.equal(veces('tirar'), 3); assert.equal(veces('bisagra_rodilla'), 2); paso('frecuencia 0: el estímulo no se planifica esa semana');
    const avisos = []; fr = Object.fromEntries(CL.map(c => [c, 3])); planner.repartirFrecuencias(CL, fr, 5, semanaIni, avisos, null);
    assert.equal(avisos.length, 1); paso('si no entra todo, avisa cuáles se trabajan menos veces');
    const a1 = planner.repartirFrecuencias(CL, fr, 5, '2026-11-02', null, null), a2 = planner.repartirFrecuencias(CL, fr, 5, '2026-11-09', null, null);
    assert.notDeepEqual(a1, a2); paso('lo que queda afuera rota de una semana a otra');
    // guardar y leer desde la API
    r = await api('GET', '/api/formatos-semana?semana=' + semanaIni, undefined, admin); const f0 = r.data.formatos[0];
    const body = r.data.formatos.map(f => ({ id: f.id, estaciones: 5, rondas: 3, trabajo_seg: 40, descanso_seg: 20, patrones: f.patrones, capacidades: f.capacidades, energias: f.energias, frecuencias: f.id === f0.id ? { patrones: { empujar: 3, tirar: 1, basura: 9 } } : {} }));
    r = await api('PUT', '/api/formatos-semana', { semana: semanaIni, formatos: body }, admin); assert.equal(r.status, 200, JSON.stringify(r.data));
    r = await api('GET', '/api/formatos-semana?semana=' + semanaIni, undefined, admin); const g0 = r.data.formatos.find(f => f.id === f0.id);
    assert.deepEqual(g0.frecuencias, { patrones: { empujar: 3, tirar: 1 } }); paso('la API guarda las frecuencias de cada formato (y descarta claves inválidas)');

    console.log('6) Hark Pro: planificación activada por defecto, WhatsApp apagado');
    r = await api('GET', '/api/hark', undefined, admin); assert.equal(r.data.plan.estado, 'aprendiendo'); assert.equal(r.data.plan.activo, true); assert.equal(r.data.wa.activo, false); paso('V11: el aprendizaje de la planificación viene activado por defecto y WhatsApp apagado');
    r = await api('PUT', '/api/hark/plan', { activo: true, desde: '2026-11-05', hasta: '2026-12-05' }, admin); assert.equal(r.data.estado, 'aprendiendo'); paso('el administrador activa Hark Pro con un período');
    r = await api('PUT', '/api/hark/plan', { activo: true, desde: '2026-12-05', hasta: '2026-11-05' }, admin); assert.equal(r.status, 400); paso('período inválido: rechazado');
    r = await api('PUT', '/api/hark/wa', { activo: true }, admin); assert.equal(r.status, 400); paso('WhatsApp exige confirmar el consentimiento');
    r = await api('POST', '/api/hark/wa/captura', { mensajes: [] }); assert.ok([401, 403].includes(r.status)); paso('la captura rechaza pedidos sin la clave local');
    r = await api('GET', '/api/hark', undefined, undefined); assert.ok([401, 403].includes(r.status)); paso('Hark Pro es solo para el administrador');
    const hark = require('../src/hark'); const dbm = require('../src/db');
    const ids = dbm.all('SELECT id FROM ejercicios LIMIT 3').map(x => x.id);
    hark.configurarPlan({ activo: true, desde: '2026-11-05', hasta: '2027-06-01' });
    for (let i = 0; i < 12; i++) hark.registrarCambio({ usuario_id: 1, profesor_id: 7, formato_id: 1, fecha_clase: '2026-11-06', patron: 'tirar', antes_id: ids[1], despues_id: ids[0] });
    assert.equal(hark.estadoPlan().estado, 'aprendiendo'); assert.equal(hark.bonus(7)(ids[0]), 0); paso('mientras aprende no cambia la planificación');
    hark.configurarPlan({ activo: true, desde: '2020-01-01', hasta: '2020-02-01' });
    const b = hark.bonus(7); assert.equal(hark.estadoPlan().estado, 'aplicando'); assert.ok(b(ids[0]) > 0 && b(ids[1]) < 0 && b(ids[2]) === 0); paso('terminado el período: favorece lo que el profesor eligió y evita lo que sacó');
    assert.ok(hark.resumenPlan().preferidos[0].veces === 12); paso('el resumen muestra qué aprendió');
    hark.configurarPlan({ activo: false }); assert.equal(hark.bonus(7)(ids[0]), 0); paso('apagado: vuelve a la planificación estándar');
    // WhatsApp
    dbm.run("INSERT INTO clientes (nombre, fecha_alta, precio_plan, fecha_baja, celular, creado) VALUES ('Laura Gómez', '2026-10-01', 0, '2026-12-01', '+5491155551234', '2026-10-01')");
    const cli = dbm.get("SELECT id FROM clientes WHERE nombre = 'Laura Gómez'").id;
    hark.configurarWA({ activo: true, consentimiento: true }, 'Dueño');
    const M = (uid, dir, texto, hora) => ({ uid, tel: '5491155551234', nombre: 'Laura', dir, fecha: '2026-11-05', hora, texto });
    const n = hark.guardarMensajes([M('a1', 'in', 'Hola profe! Me duele la rodilla desde la clase del lunes, no sé si puedo hacer sentadillas', '10:01'), M('a2', 'out', 'Hola Laura! Tranqui, hoy hacé la versión sin salto y avisame cómo te sentís 💪', '10:05'), M('a3', 'in', 'Gracias! Además el jueves no voy a poder ir al turno de las 19', '10:07'), M('a4', 'out', 'Dale, genial! Te anoto la ausencia jaja 😉', '10:09'), M('a5', 'in', 'jajaja ok', '10:10')]);
    assert.equal(n, 5); assert.equal(hark.guardarMensajes([M('a1', 'in', 'repetido', '10:01')]), 0); paso('guarda los mensajes una sola vez');
    assert.equal(dbm.get("SELECT cliente_id FROM hark_wa_msgs WHERE uid = 'a1'").cliente_id, cli); paso('asocia la conversación con el cliente por su número');
    assert.equal(hark.procesarResumenes().creados, 0); paso('espera a que la conversación quede quieta antes de resumir');
    assert.equal(hark.procesarResumenes({ forzar: true }).creados, 1);
    const com = dbm.get("SELECT * FROM comentarios WHERE tipo = 'cliente' AND ref_id = ?", cli);
    assert.ok(com && com.autor === 'Hark Pro' && com.fecha === require('../src/util').nowAR().fecha); assert.match(com.texto, /Lesión o molestia/); assert.match(com.texto, /rodilla/); assert.match(com.texto, /Asistencia y horarios/); paso('el resumen cae en Seguimiento → Comentarios con la fecha de creación');
    assert.equal(hark.procesarResumenes({ forzar: true }).creados, 0); paso('no repite el resumen');
    hark.guardarMensajes([{ uid: 'b1', tel: '5491100000000', nombre: 'Desconocido', dir: 'in', fecha: '2026-11-05', hora: '11:00', texto: 'Hola, quería info sobre el gimnasio' }]);
    assert.equal(hark.procesarResumenes({ forzar: true }).creados, 0); paso('un número que no es de ningún cliente queda pendiente, sin comentario');
    hark.guardarMensajes([{ uid: 'c1', tel: '5491155551234', nombre: 'Laura', dir: 'in', fecha: '2026-11-05', hora: '12:00', texto: 'Buen finde, saludos a todos' }]);
    hark.procesarResumenes({ forzar: true }); assert.equal(dbm.all("SELECT 1 FROM comentarios WHERE tipo = 'cliente' AND ref_id = ?", cli).length, 1); paso('una charla que no es de entrenamiento no genera comentario');
    const es = hark.estilo(); assert.ok(es.mensajes === 2 && es.con_emoji === 100 && es.emojis.length > 0); paso('aprende el estilo con que escribe el gimnasio (emojis, tono)');
    hark.borrarWA(); assert.equal(hark.estadoWA().mensajes, 0); paso('se puede borrar todo lo capturado');
    assert.ok(hark.estadoSeg().envia === false); paso('el seguimiento a vencidos solo queda configurado: no envía nada');

    console.log('\n7) "Falta registrar pago" solo con plan cargado');
    const hoyISO = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), manana = new Date(Date.now() - 3 * 3600e3 + 40 * 86400e3).toISOString().slice(0, 10);
    r = await api('POST', '/api/clientes', { nombre: 'Plan Cero', fecha_alta: hoyISO, fecha_baja: hoyISO, precio_plan: 0 }, admin); const c0 = r.data.id;
    r = await api('POST', '/api/clientes', { nombre: 'Plan Pago', fecha_alta: hoyISO, fecha_baja: hoyISO, precio_plan: 30000 }, admin); const c1 = r.data.id;
    await api('PUT', '/api/clientes/' + c0, { fecha_baja: manana }, admin); await api('PUT', '/api/clientes/' + c1, { fecha_baja: manana }, admin);
    r = await api('GET', '/api/clientes/' + c0, undefined, admin); assert.ok(!r.data.falta_pago); paso('plan $0 con la baja corrida: no muestra "Falta registrar pago"');
    r = await api('GET', '/api/clientes/' + c1, undefined, admin); assert.ok(r.data.falta_pago); paso('plan con precio y baja corrida sin pago: sí lo muestra');
    await api('PUT', '/api/clientes/' + c1, { precio_plan: 0 }, admin); r = await api('GET', '/api/clientes/' + c1, undefined, admin); assert.ok(!r.data.falta_pago); paso('si el plan pasa a $0 el aviso desaparece');

    console.log('\n8) V11: alias de WhatsApp, importar con Hark Pro y clase fantasma');
    // (el servidor y esta prueba usan bases distintas: lo que va por la API se prueba contra el servidor y lo de Hark directo sobre la base local)
    r = await api('POST', '/api/clientes', { nombre: 'Laura API', fecha_alta: hoyISO, fecha_baja: manana, alias_wa: 'Lau Gym; Laurita' }, admin); const cliApi = r.data.id;
    r = await api('GET', '/api/clientes/' + cliApi, undefined, admin); assert.equal(r.data.alias_wa, 'Lau Gym; Laurita'); paso('el cliente guarda su Alias WhatsApp');
    r = await api('PUT', '/api/clientes/' + cliApi, { alias_wa: 'Lau Gym; Laurita; Lau G' }, admin); r = await api('GET', '/api/clientes/' + cliApi, undefined, admin); assert.equal(r.data.alias_wa, 'Lau Gym; Laurita; Lau G'); paso('el alias se puede editar');
    dbm.run('UPDATE clientes SET alias_wa = ? WHERE id = ?', 'Lau Gym; Laurita', cli);
    hark.configurarWA({ activo: true, consentimiento: true }, 'Dueño');
    const SN = (uid, nombre, texto) => ({ uid, tel: '', nombre, dir: 'in', fecha: '2026-11-05', hora: '09:00', texto });
    assert.equal(hark.guardarMensajes([SN('z1', 'laurita', 'Hoy me duele la espalda, ¿puedo hacer la rutina igual?'), SN('z2', 'Otra Persona', 'Me duele el hombro')]), 2); paso('acepta chats sin número y reconoce al alumno por el alias (sin importar mayúsculas)');
    let im = hark.importarCliente(cli); assert.equal(im.creados, 1); assert.equal(im.mensajes, 1); paso('"Importar con Hark Pro" crea el resumen de ese alumno');
    const cz = dbm.all("SELECT texto, autor FROM comentarios WHERE tipo = 'cliente' AND ref_id = ? ORDER BY id DESC", cli)[0]; assert.equal(cz.autor, 'Hark Pro'); assert.match(cz.texto, /espalda/); paso('el comentario queda en Seguimiento con autor Hark Pro');
    im = hark.importarCliente(cli); assert.equal(im.creados, 0); assert.equal(im.mensajes, 0); paso('importar de nuevo no repite el resumen');
    assert.ok(dbm.all("SELECT 1 FROM hark_wa_msgs WHERE nombre_chat = 'Otra Persona' AND resumido = 0 AND cliente_id IS NULL").length === 1); paso('el chat de otra persona sin alias queda pendiente, sin comentario');
    r = await api('POST', '/api/clientes/' + cliApi + '/hark-importar', undefined, admin); assert.equal(r.status, 200); assert.equal(r.data.creados, 0); paso('el botón de la ficha responde (sin conversaciones nuevas)');
    // el alumno entra por el botón "Chatear con el gimnasio": el código OMEGA#id enlaza el chat y guarda el alias
    assert.equal(hark.guardarMensajes([{ uid: 'c1', tel: '', nombre: 'Otra Persona', dir: 'in', fecha: '2026-11-05', hora: '09:05', texto: 'Hola! Soy Laura (alumno OMEGA#' + cli + ') ' }]), 1);
    assert.ok(dbm.get('SELECT alias_wa FROM clientes WHERE id = ?', cli).alias_wa.includes('Otra Persona')); assert.equal(dbm.all("SELECT 1 FROM hark_wa_msgs WHERE nombre_chat = 'Otra Persona' AND cliente_id = ?", cli).length, 2); paso('el código OMEGA#id del mensaje enlaza el chat con el alumno y guarda su alias de WhatsApp');
    im = hark.importarCliente(cli); assert.equal(im.creados, 1); assert.ok(dbm.get("SELECT texto FROM comentarios WHERE tipo = 'cliente' AND ref_id = ? ORDER BY id DESC", cli).texto.includes('hombro')); paso('lo que había quedado pendiente de ese chat se resume al reconocerlo');
    r = await api('POST', '/api/clientes', { nombre: 'Alumno Horario', fecha_alta: hoyISO, fecha_baja: manana }, admin); const acc = r.data.acceso, idH = r.data.id;
    const tk = (await api('POST', '/api/login', { username: acc.usuario, password: acc.clave })).data.token;
    r = await api('POST', '/api/asistencias', { cliente_ids: [idH], hora: 0 }, admin); assert.equal(r.status, 200, JSON.stringify(r.data));   // crea una sesión de esta hora sin clase en la agenda
    r = await api('GET', '/api/clase?fecha=' + hoyISO, undefined, tk); assert.ok(r.data.clases.every(c => c.formato)); paso('el alumno no ve una clase que no existe en la agenda (la de las 00:00)');
    r = await api('GET', '/api/clase?fecha=' + hoyISO, undefined, admin); assert.ok(r.data.clases.length >= 1); paso('el personal sigue viendo la sesión (por si hay asistencias cargadas)');
    r = await api('GET', '/api/mi-perfil', undefined, tk); assert.equal(r.data.whatsapp_gym, ''); paso('sin número de WhatsApp del gimnasio no hay botón');
    await api('PUT', '/api/config-pais', { whatsapp_gym: '1155550000' }, admin);
    r = await api('GET', '/api/mi-perfil', undefined, tk); assert.match(r.data.whatsapp_gym, /^https:\/\/wa\.me\/\d+\?text=.*OMEGA%23\d+/); paso('el alumno tiene el botón "Chatear con el gimnasio" con su nombre y código en el mensaje');
    r = await api('GET', '/api/clase?fecha=' + hoyISO, undefined, tk); assert.match(r.data.whatsapp_gym, /wa\.me/); paso('el botón también está en la pantalla de Entrenamiento');

    console.log('\n' + ok + ' comprobaciones OK');
  } catch (e) { console.error('FALLÓ:', e.message, '\n', log.slice(-800)); process.exitCode = 1; }
  finally { srv.kill(); fs.rmSync(D, { recursive: true, force: true }); }
})();
