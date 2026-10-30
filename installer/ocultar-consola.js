'use strict';
// Convierte una copia del motor (node.exe) en un programa "de ventana": sin consola, así el servidor de OMEGA corre en segundo plano
// sin ninguna ventana negra. Solo cambia el campo "Subsystem" del encabezado PE (3 = consola -> 2 = ventana).
// Uso: node ocultar-consola.js <entrada.exe> <salida.exe>
const fs = require('node:fs');
const [, , entrada, salida] = process.argv;
const b = fs.readFileSync(entrada);
if (b.readUInt16LE(0) !== 0x5a4d) throw new Error('No es un ejecutable de Windows');
const pe = b.readUInt32LE(0x3c);
if (b.toString('latin1', pe, pe + 4) !== 'PE\0\0') throw new Error('Encabezado PE inválido');
const opt = pe + 24, magia = b.readUInt16LE(opt);
if (magia !== 0x10b && magia !== 0x20b) throw new Error('Formato PE desconocido');
const campo = opt + 68;
if (b.readUInt16LE(campo) !== 3) throw new Error('El ejecutable no es de consola (subsistema ' + b.readUInt16LE(campo) + ')');
b.writeUInt16LE(2, campo);
fs.writeFileSync(salida, b);
console.log('OK ' + salida + ' (' + (magia === 0x20b ? '64' : '32') + ' bits, sin consola)');
