/**
 * AIRA Electron Preload Script
 * Minimal — only exposes version info to the renderer.
 */
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('airaElectron', {
  isElectron: true,
  version: process.env.npm_package_version ?? 'dev',
});
