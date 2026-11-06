// Planilla modelo de clientes: arma un .xlsx real (con lista desplegable de planes) sin librerías.
// El .xlsx es un ZIP de archivos XML; se escribe "sin comprimir" (store), que Excel y Sheets leen sin problema.
const XlsxModelo = (() => {
  const enc = new TextEncoder();
  const TABLA = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = TABLA[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(archivos) {
    const partes = [], central = []; let off = 0;
    for (const [nombre, texto] of archivos) {
      const n = enc.encode(nombre), d = enc.encode(texto), crc = crc32(d);
      const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, n.length, true); h.setUint16(28, 0, true);
      partes.push(new Uint8Array(h.buffer), n, d);
      const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true); c.setUint16(28, n.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), n);
      off += 30 + n.length + d.length;
    }
    const tamC = central.reduce((a, x) => a + x.length, 0);
    const fin = new DataView(new ArrayBuffer(22)); fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true); fin.setUint32(12, tamC, true); fin.setUint32(16, off, true);
    return new Blob([...partes, ...central, new Uint8Array(fin.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  const x = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const col = (i) => String.fromCharCode(65 + i);
  const celda = (i, r, v, estilo) => `<c r="${col(i)}${r}" t="inlineStr"${estilo ? ' s="' + estilo + '"' : ''}><is><t xml:space="preserve">${x(v)}</t></is></c>`;
  const celdaNum = (i, r, v) => `<c r="${col(i)}${r}"><v>${Number(v) || 0}</v></c>`;
  const hoja = (filas, anchos, extra = '') => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${anchos.map((a, i) => `<col min="${i + 1}" max="${i + 1}" width="${Array.isArray(a) ? a[0] : a}" customWidth="1"${Array.isArray(a) && a[1] ? ' style="' + a[1] + '"' : ''}/>`).join('')}</cols><sheetData>${filas.map((f, i) => `<row r="${i + 1}">${f}</row>`).join('')}</sheetData>${extra}</worksheet>`;
  const dinero = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-AR');

  // planes: [{nombre, precio_efectivo, precio_mp}]
  function planillaClientes(planes) {
    const etiquetas = planes.map(p => `${p.nombre} (Efectivo ${dinero(p.precio_efectivo)} · Mercado Pago ${dinero(p.precio_mp)})`);
    const cab = ['Nombre y Apellido (obligatorio)', 'Plan', 'Fecha de alta', 'Fecha de baja', 'Celular', 'Instagram'];
    const clientes = hoja([cab.map((t, i) => celda(i, 1, t, 1)).join('')], [34, 52, [16, 2], [16, 2], [18, 3], 20],
      `<dataValidations count="4"><dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="Plan" error="Elegí un plan de la lista (hoja Planes)." promptTitle="Plan" prompt="Elegí el plan de la lista" sqref="B2:B2000"><formula1>Planes!$A$2:$A$${Math.max(2, etiquetas.length + 1)}</formula1></dataValidation>
        <dataValidation type="date" operator="between" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="Fecha de alta" error="Escribí la fecha como DD/MM/AAAA (por ejemplo 05/11/2026)." promptTitle="Fecha de alta" prompt="Formato DD/MM/AAAA" sqref="C2:C2000"><formula1>32874</formula1><formula2>73415</formula2></dataValidation>
        <dataValidation type="date" operator="between" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="Fecha de baja" error="Escribí la fecha como DD/MM/AAAA (por ejemplo 05/12/2026)." promptTitle="Fecha de baja" prompt="Formato DD/MM/AAAA" sqref="D2:D2000"><formula1>32874</formula1><formula2>73415</formula2></dataValidation>
        <dataValidation type="custom" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="Celular" error="El celular debe tener solo números (se aceptan espacios, guiones y paréntesis)." promptTitle="Celular" prompt="Solo números" sqref="E2:E2000"><formula1>ISNUMBER(--SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(E2," ",""),"-",""),"(",""),")",""),"+",""),".",""))</formula1></dataValidation></dataValidations>`);
    const filasPlanes = [['Plan (con precios)', 'Precio efectivo', 'Precio Mercado Pago'].map((t, i) => celda(i, 1, t, 1)).join('')]
      .concat(planes.map((p, k) => celda(0, k + 2, etiquetas[k]) + celdaNum(1, k + 2, p.precio_efectivo) + celdaNum(2, k + 2, p.precio_mp)));
    const planesX = hoja(filasPlanes, [64, 18, 22]);
    const instr = ['Cómo completar la planilla', '', 'Solo “Nombre y Apellido” es obligatorio. Todo lo demás se puede dejar vacío y completar después con otra importación.', 'Fecha de baja vacía: se completa con la fecha de alta, así que el cliente queda vencido al día siguiente hasta que se registre su pago.',
      'Plan: elegilo de la lista desplegable. Los planes se cargan en OMEGA (Finanzas → Planes); acá aparecen con sus precios.', 'Fechas: siempre DD/MM/AAAA (2 dígitos de día, 2 de mes y 4 de año), por ejemplo 05/11/2026. Celular: solo números. Antes de importar, OMEGA revisa todo el archivo y te dice en qué fila está cada error.','Si no ponés fecha de alta se usa la de hoy; si no ponés fecha de baja, un mes después del alta.',
      'Al importar, cada alumno recibe su usuario para la app web. Si importás otra vez un archivo con datos nuevos, no se duplica nadie: se actualizan los que ya existen y se agregan los nuevos.']
      .map((t, k) => celda(0, k + 1, t, k === 0 ? 1 : 0));
    return zip([
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Clientes" sheetId="1" r:id="rId1"/><sheet name="Planes" sheetId="2" r:id="rId2"/><sheet name="Instrucciones" sheetId="3" r:id="rId3"/></sheets></workbook>'],
      ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
      ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFF6B35"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
      ['xl/worksheets/sheet1.xml', clientes], ['xl/worksheets/sheet2.xml', planesX], ['xl/worksheets/sheet3.xml', hoja(instr, [120])],
    ]);
  }
  // Planilla modelo de rutinas: hoja Rutinas (una fila por ejercicio), hoja Ejercicios (un patrón por columna, sus ejercicios hacia abajo)
  // y hoja Instrucciones. En Rutinas, “Ejercicio” es una lista desplegable que se arma según el patrón elegido en la misma fila.
  // patrones: [nombre]; ejercicios: [{ nombre, zona }]
  function planillaRutinas(patrones, ejercicios) {
    const pats = patrones.length ? patrones : ['(sin patrones)'];
    const cab = ['Nombre de la rutina', 'Descripción (opcional)', 'Patrón de movimiento', 'Ejercicio', 'Series (1-99)', 'Repeticiones (1-99)', 'Peso (0-999) · vacío = peso corporal', 'Descanso en segundos (0-999)', 'Segundos por serie (0-999)'];
    const rutinas = hoja([cab.map((t, i) => celda(i, 1, t, 1)).join('')], [30, 34, 34, 40, 14, 18, 22, 22, 22],
      `<dataValidations count="7">
        <dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="Patrón" error="Elegí un patrón de la lista." promptTitle="Patrón de movimiento" prompt="Elegí el patrón de la lista" sqref="C2:C2000"><formula1>Ejercicios!$A$1:$${col(pats.length - 1)}$1</formula1></dataValidation>
        <dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="Ejercicio" error="Elegí un ejercicio de la lista (primero elegí el patrón de movimiento)." promptTitle="Ejercicio" prompt="Elegí primero el patrón; la lista muestra solo sus ejercicios" sqref="D2:D2000"><formula1>OFFSET(Ejercicios!$A$2,0,MATCH($C2,Ejercicios!$A$1:$${col(pats.length - 1)}$1,0)-1,MAX(1,COUNTA(OFFSET(Ejercicios!$A$2,0,MATCH($C2,Ejercicios!$A$1:$${col(pats.length - 1)}$1,0)-1,500,1))),1)</formula1></dataValidation>
        <dataValidation type="whole" operator="between" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="Series" error="Número entero de 1 a 99." promptTitle="Series" prompt="Entero de 1 a 99" sqref="E2:E2000"><formula1>1</formula1><formula2>99</formula2></dataValidation>
        <dataValidation type="whole" operator="between" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="Repeticiones" error="Número entero de 1 a 99." promptTitle="Repeticiones" prompt="Entero de 1 a 99" sqref="F2:F2000"><formula1>1</formula1><formula2>99</formula2></dataValidation>
        <dataValidation type="whole" operator="between" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="Peso" error="Número entero de 0 a 999." promptTitle="Peso" prompt="Entero de 0 a 999. Vacío o 0 = peso corporal" sqref="G2:G2000"><formula1>0</formula1><formula2>999</formula2></dataValidation>
        <dataValidation type="whole" operator="between" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="Descanso" error="Número entero de 0 a 999 (segundos)." promptTitle="Descanso" prompt="Segundos, de 0 a 999" sqref="H2:H2000"><formula1>0</formula1><formula2>999</formula2></dataValidation>
        <dataValidation type="whole" operator="between" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="Segundos por serie" error="Número entero de 0 a 999 (segundos)." promptTitle="Segundos por serie" prompt="Tiempo de trabajo en segundos, de 0 a 999" sqref="I2:I2000"><formula1>0</formula1><formula2>999</formula2></dataValidation></dataValidations>`);
    const porPat = pats.map(pn => ejercicios.filter(e => e.zona === pn).map(e => e.nombre));
    const alto = Math.max(1, ...porPat.map(l => l.length));
    const filasEj = [pats.map((pn, i) => celda(i, 1, pn, 1)).join('')];
    for (let r = 0; r < alto; r++) filasEj.push(pats.map((pn, i) => porPat[i][r] !== undefined ? celda(i, r + 2, porPat[i][r]) : '').join(''));
    const ejX = hoja(filasEj, pats.map(() => 34));
    const instr = ['Cómo completar la planilla de rutinas', '',
      'Una fila por ejercicio. Las filas con el mismo “Nombre de la rutina” forman una sola rutina, en el orden en que están escritas.',
      'La descripción es opcional (alcanza con escribirla en la primera fila de la rutina).',
      'Patrón de movimiento: elegilo de la lista. Ejercicio: la lista se arma sola con los ejercicios de ese patrón (están en la hoja “Ejercicios”, un patrón por columna).',
      'Series y Repeticiones: enteros de 1 a 99. Peso: de 0 a 999; si lo dejás vacío (o en 0) el ejercicio es con peso corporal.',
      'Descanso y Segundos por serie (tiempo de trabajo): enteros de 0 a 999, en segundos.',
      'Si ya tenés una rutina con el mismo nombre, la nueva se guarda como “Nombre (fecha de creación)” y la anterior no se toca.',
      'Antes de importar, OMEGA revisa todo el archivo y te dice en qué fila está cada error. Mientras haya errores no se importa nada.']
      .map((t, k) => celda(0, k + 1, t, k === 0 ? 1 : 0));
    return libro(['Rutinas', 'Ejercicios', 'Instrucciones'], [rutinas, ejX, hoja(instr, [130])]);
  }
  const ESTILOS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFF6B35"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  function libro(nombres, hojas) {
    const cab = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    return zip([
      ['[Content_Types].xml', cab + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' + nombres.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
      ['_rels/.rels', cab + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', cab + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + nombres.map((n, i) => `<sheet name="${x(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>'],
      ['xl/_rels/workbook.xml.rels', cab + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + nombres.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + `<Relationship Id="rId${nombres.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
      ['xl/styles.xml', ESTILOS],
      ...hojas.map((h, i) => [`xl/worksheets/sheet${i + 1}.xml`, h]),
    ]);
  }
  return { planillaClientes, planillaRutinas, crc32 };
})();
