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
  const hoja = (filas, anchos, extra = '') => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${anchos.map((a, i) => `<col min="${i + 1}" max="${i + 1}" width="${a}" customWidth="1"/>`).join('')}</cols><sheetData>${filas.map((f, i) => `<row r="${i + 1}">${f}</row>`).join('')}</sheetData>${extra}</worksheet>`;
  const dinero = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-AR');

  // planes: [{nombre, precio_efectivo, precio_mp}]
  function planillaClientes(planes) {
    const etiquetas = planes.map(p => `${p.nombre} (Efectivo ${dinero(p.precio_efectivo)} · Mercado Pago ${dinero(p.precio_mp)})`);
    const cab = ['Nombre y Apellido (obligatorio)', 'Plan', 'Fecha de alta', 'Fecha de baja', 'Celular', 'Instagram'];
    const clientes = hoja([cab.map((t, i) => celda(i, 1, t, 1)).join('')], [34, 52, 16, 16, 18, 20],
      `<dataValidations count="1"><dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="Plan" error="Elegí un plan de la lista (hoja Planes)." promptTitle="Plan" prompt="Elegí el plan de la lista" sqref="B2:B2000"><formula1>Planes!$A$2:$A$${Math.max(2, etiquetas.length + 1)}</formula1></dataValidation></dataValidations>`);
    const filasPlanes = [['Plan (con precios)', 'Precio efectivo', 'Precio Mercado Pago'].map((t, i) => celda(i, 1, t, 1)).join('')]
      .concat(planes.map((p, k) => celda(0, k + 2, etiquetas[k]) + celdaNum(1, k + 2, p.precio_efectivo) + celdaNum(2, k + 2, p.precio_mp)));
    const planesX = hoja(filasPlanes, [64, 18, 22]);
    const instr = ['Cómo completar la planilla', '', 'Solo “Nombre y Apellido” es obligatorio. Todo lo demás se puede dejar vacío y completar después con otra importación.',
      'Plan: elegilo de la lista desplegable. Los planes se cargan en OMEGA (Finanzas → Planes); acá aparecen con sus precios.', 'Fechas: escribilas como 2026-09-01 o 01/09/2026. Si no ponés fecha de alta se usa la de hoy; si no ponés fecha de baja, un mes después del alta.',
      'Al importar, cada alumno recibe su usuario para la app web. Si importás otra vez un archivo con datos nuevos, no se duplica nadie: se actualizan los que ya existen y se agregan los nuevos.']
      .map((t, k) => celda(0, k + 1, t, k === 0 ? 1 : 0));
    return zip([
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Clientes" sheetId="1" r:id="rId1"/><sheet name="Planes" sheetId="2" r:id="rId2"/><sheet name="Instrucciones" sheetId="3" r:id="rId3"/></sheets></workbook>'],
      ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
      ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFF6B35"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
      ['xl/worksheets/sheet1.xml', clientes], ['xl/worksheets/sheet2.xml', planesX], ['xl/worksheets/sheet3.xml', hoja(instr, [120])],
    ]);
  }
  return { planillaClientes, crc32 };
})();
