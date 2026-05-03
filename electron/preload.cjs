/**
 * AIRA Electron Preload Script (CommonJS for sandbox compatibility)
 */
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('airaElectron', {
  isElectron: true,
  version: process.env.npm_package_version || 'dev',
});
