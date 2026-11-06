'use strict';
// Puente mínimo entre OMEGA y el programa de escritorio (ventana principal).
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('omegaEscritorio', { abrirWhatsApp: () => ipcRenderer.invoke('hark:abrir-wa') });
