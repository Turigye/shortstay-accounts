import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";

import { registerIpcHandlers } from "./ipc/register-handlers";
import { applySecurityGuards } from "./security";
import { createBrowserWindowOptions } from "./windowOptions";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

registerIpcHandlers(ipcMain);

function createWindow(): BrowserWindow {
  const window = new BrowserWindow(
    createBrowserWindowOptions(path.join(__dirname, "index.js")),
  );

  applySecurityGuards(window);
  window.once("ready-to-show", () => window.show());

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  return window;
}

void app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
