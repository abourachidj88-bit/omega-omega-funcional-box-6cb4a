'use strict';
// Actualizaciones de la estructura de la base de datos. Se aplican solas al iniciar, conservando todos los datos.
// (Versión 1: ilustraciones, profesores por clase, planes y medios de pago, caja, CRM, sugerencias de ejercicios.)
// (Versión 2: campañas, reservas, rutinas, deshacer pagos, notificaciones, intensidad cardiovascular, amortización.)
function aplicar(db) {
  const cols = (t) => db.prepare('PRAGMA table_info(' + t + ')').all().map(c => c.name);
  const add = (t, c, def) => { if (!cols(t).includes(c)) db.exec('ALTER TABLE ' + t + ' ADD COLUMN ' + c + ' ' + def); };

  add('ejercicios', 'patron', 'TEXT');          // tipo de movimiento (para las ilustraciones)
  add('ejercicios', 'img1', 'TEXT');            // foto propia: posición inicial
  add('ejercicios', 'img2', 'TEXT');            // foto propia: posición media
  add('ejercicios', 'img3', 'TEXT');            // foto propia: posición final
  add('ejercicios', 'origen', "TEXT NOT NULL DEFAULT 'base'");
  add('agenda', 'profesor_id', 'INTEGER');      // profesor asignado a cada clase de la semana
  add('clientes', 'plan_id', 'INTEGER');
  add('pagos', 'metodo', 'TEXT');               // efectivo | mercadopago
  add('pagos', 'plan_id', 'INTEGER');
  add('finanzas', 'medio', 'TEXT');             // efectivo | mercadopago | otro
  add('finanzas', 'en_caja', 'INTEGER NOT NULL DEFAULT 0'); // 1 = mueve el efectivo físico de la caja

  // ---- Versión 2
  add('usuarios', 'permisos', 'TEXT');                          // JSON con los permisos del profesor (vacío = Profesor estándar)
  add('clientes', 'falta_pago', 'INTEGER NOT NULL DEFAULT 0');  // 1 = se corrió la fecha de baja sin registrar el pago
  add('pagos', 'meses', 'INTEGER');                             // meses que sumó el pago (para poder deshacerlo)
  add('pagos', 'falta_antes', 'INTEGER');                       // el cartel "Falta registrar pago" estaba activo cuando se cargó este pago
  add('pagos', 'baja_anterior', 'TEXT');                        // fecha de baja antes del pago
  add('finanzas', 'devengar_meses', 'INTEGER NOT NULL DEFAULT 1'); // amortización: en cuántos meses se reparte el gasto
  add('ejercicios', 'intensidad', 'TEXT');                      // baja | moderada | alta
  add('formatos', 'cupo_estacion', 'INTEGER');                  // personas por estación/circuito
  add('formatos', 'intensidad_min', 'TEXT');                    // HIIT: exige intensidad moderada o alta
  add('circuitos', 'modo', "TEXT NOT NULL DEFAULT 'ia'");       // ia | manual

  // ---- Versión 3
  add('formatos', 'sin_trabajo', 'INTEGER NOT NULL DEFAULT 0');   // 1 = el formato no usa intervalos de trabajo (clase corrida, ej. Flex)
  add('formatos', 'sin_descanso', 'INTEGER NOT NULL DEFAULT 0');  // 1 = el formato no usa intervalos de descanso
  add('formatos', 'duracion_min', 'INTEGER');                     // duración de la clase cuando no usa intervalos (por defecto 60)

  // ---- Versión 5
  const eraNueva = !cols('formatos').includes('rondas');
  add('formatos', 'rondas', 'INTEGER NOT NULL DEFAULT 3');        // cantidad de rounds del formato (1, 2 o 3); con menos de 3 se usan las progresiones más exigentes
  if (eraNueva) db.exec("UPDATE formatos SET rondas = 2 WHERE nombre IN ('Flex', 'Z7') AND activo = 1");   // Flex y Z7 se hacen en 2 rounds

  // ---- Versión 6: agenda y formatos por semana, estaciones y estímulos por formato, biblioteca por estímulos
  add('formatos', 'estaciones', 'INTEGER');                      // cantidad de estaciones del formato (vacío = la general del gimnasio)
  add('formatos', 'patrones', 'TEXT');                           // patrones de movimiento que usa (claves separadas por coma)
  add('formatos', 'capacidades', 'TEXT');                        // capacidades físicas integradas
  add('formatos', 'energias', 'TEXT');                           // sistema energético
  add('ejercicios', 'capacidad', 'TEXT');
  add('ejercicios', 'energia', 'TEXT');
  db.exec(`
    CREATE TABLE IF NOT EXISTS semanas_cfg (
      semana TEXT PRIMARY KEY,
      agenda INTEGER NOT NULL DEFAULT 0,
      formatos INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS agenda_semana (
      semana TEXT NOT NULL,
      dia INTEGER NOT NULL,
      hora INTEGER NOT NULL,
      formato_id INTEGER,
      profesor_id INTEGER,
      PRIMARY KEY (semana, dia, hora)
    );
    CREATE TABLE IF NOT EXISTS formatos_semana (
      semana TEXT NOT NULL,
      formato_id INTEGER NOT NULL,
      estaciones INTEGER,
      trabajo_seg INTEGER,
      descanso_seg INTEGER,
      sin_trabajo INTEGER NOT NULL DEFAULT 0,
      sin_descanso INTEGER NOT NULL DEFAULT 0,
      duracion_min INTEGER,
      rondas INTEGER NOT NULL DEFAULT 3,
      cupo_estacion INTEGER,
      intensidad_min TEXT,
      patrones TEXT,
      capacidades TEXT,
      energias TEXT,
      PRIMARY KEY (semana, formato_id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS campanas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'normal',
      activo INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS reservas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      hora INTEGER NOT NULL,
      creado TEXT NOT NULL,
      UNIQUE (cliente_id, fecha, hora)
    );
    CREATE INDEX IF NOT EXISTS idx_reservas_fecha ON reservas(fecha, hora);
    CREATE TABLE IF NOT EXISTS notificaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      titulo TEXT NOT NULL,
      detalle TEXT,
      lead_id INTEGER,
      cliente_id INTEGER,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      resolucion TEXT,
      creado TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rutinas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      duracion_min INTEGER NOT NULL DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1,
      creado TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rutina_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rutina_id INTEGER NOT NULL,
      orden INTEGER NOT NULL DEFAULT 0,
      ejercicio_id INTEGER,
      zona TEXT,
      series INTEGER NOT NULL DEFAULT 3,
      repeticiones TEXT,
      peso TEXT,
      descanso_seg INTEGER NOT NULL DEFAULT 60,
      seg_serie INTEGER NOT NULL DEFAULT 40
    );
    CREATE INDEX IF NOT EXISTS idx_rutina_items ON rutina_items(rutina_id, orden);
    CREATE TABLE IF NOT EXISTS rutina_dia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      formato_id INTEGER NOT NULL DEFAULT 0,
      rutina_id INTEGER NOT NULL,
      UNIQUE (fecha, formato_id)
    );
    CREATE TABLE IF NOT EXISTS rutina_clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rutina_id INTEGER NOT NULL,
      cliente_id INTEGER NOT NULL,
      dias TEXT NOT NULL,
      creado TEXT,
      UNIQUE (rutina_id, cliente_id)
    );
    CREATE TABLE IF NOT EXISTS planes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      precio_efectivo REAL NOT NULL DEFAULT 0,
      precio_mp REAL NOT NULL DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS caja_dia (fecha TEXT PRIMARY KEY, saldo_inicial REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      telefono TEXT,
      redes TEXT,
      objetivo TEXT,
      profesor_id INTEGER,
      estado TEXT NOT NULL DEFAULT 'visita',
      cliente_id INTEGER,
      fecha TEXT NOT NULL,
      origen TEXT NOT NULL DEFAULT 'manual',
      nota TEXT,
      creado TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_leads_fecha ON leads(fecha);
    CREATE TABLE IF NOT EXISTS sugerencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipo_clave TEXT NOT NULL,
      zona TEXT NOT NULL,
      nombre TEXT NOT NULL,
      prog2 TEXT NOT NULL,
      prog3 TEXT NOT NULL,
      patron TEXT,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      creado TEXT NOT NULL
    );
  `);
  add('leads', 'campana_id', 'INTEGER');
  add('leads', 'referido_id', 'INTEGER');                       // alumno que recomendó
  add('leads', 'notificado', 'INTEGER NOT NULL DEFAULT 0');
  v7(db, add);
}
// Versión 7: descuentos, seguimiento de alumnos y de visitas, profesor de seguimiento en las rutinas
function v7(db, add) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS descuentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL,
      valor REAL NOT NULL,
      meses INTEGER NOT NULL DEFAULT 1,
      activo INTEGER NOT NULL DEFAULT 1,
      creado TEXT
    );
    CREATE TABLE IF NOT EXISTS seg_semana (
      cliente_id INTEGER NOT NULL,
      semana TEXT NOT NULL,
      sensacion INTEGER,
      progreso INTEGER,
      profesor_id INTEGER,
      PRIMARY KEY (cliente_id, semana)
    );
    CREATE TABLE IF NOT EXISTS comentarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      ref_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      texto TEXT NOT NULL,
      autor_id INTEGER,
      autor TEXT,
      creado TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_comentarios ON comentarios(tipo, ref_id);
  `);
  add('clientes', 'desc_id', 'INTEGER');
  add('clientes', 'desc_restantes', 'INTEGER NOT NULL DEFAULT 0');
  add('pagos', 'plan_full', 'REAL');
  add('pagos', 'descuento', 'REAL NOT NULL DEFAULT 0');
  add('pagos', 'descuento_nombre', 'TEXT');
  add('rutina_clientes', 'profesor_id', 'INTEGER');
  add('leads', 'perdido_fecha', 'TEXT');
  add('leads', 'motivo_perdido', 'TEXT');
}
module.exports = { aplicar };
