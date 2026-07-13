import type { BrowserWindowConstructorOptions } from "electron";

import { PRODUCT_NAME } from "../shared/product";

export function createBrowserWindowOptions(
  preload: string,
): BrowserWindowConstructorOptions {
  return {
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    title: PRODUCT_NAME,
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  };
}
