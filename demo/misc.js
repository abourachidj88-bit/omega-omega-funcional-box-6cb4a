'use strict';
const path = {
  join: (...a) => a.filter(Boolean).join('/').replace(/\/+/g, '/'),
  resolve: (...a) => a.filter(Boolean).join('/').replace(/\/+/g, '/'),
  basename: (p) => String(p).split('/').pop(),
  dirname: (p) => String(p).split('/').slice(0, -1).join('/') || '/',
};
const fs = { mkdirSync() {}, existsSync() { return false; }, readdirSync() { return []; }, statSync() { return { size: 0 }; }, unlinkSync() {}, copyFileSync() {}, readFileSync() { return ''; } };
module.exports = { path, fs };
