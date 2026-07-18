import { app, BrowserWindow, dialog, ipcMain, safeStorage } from "electron";
import path from "node:path";

import { createBusinessSession, type BusinessSession } from "./business-session";
import { createBusinessRepository } from "./db/repositories/business-repository";
import {
  createBusinessIpcHandlers,
  registerIpcHandlers,
} from "./ipc/register-handlers";
import { applySecurityGuards } from "./security";
import { createBrowserWindowOptions } from "./windowOptions";
import { IPC_CHANNELS } from "../shared/ipc";
import { createCredentialVault } from "./credential-vault";
import { renderReceiptHtml, type ReceiptDocument } from "./receipt-service";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

let businessSession: BusinessSession | undefined;

async function printReceipt(receipt: ReceiptDocument): Promise<{ cancelled: boolean }> {
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  try {
    await printWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(renderReceiptHtml(receipt))}`,
    );
    return await new Promise((resolve, reject) => {
      printWindow.webContents.print(
        { printBackground: true },
        (success, failureReason) => {
          if (success) resolve({ cancelled: false });
          else if (failureReason.toLocaleLowerCase().includes("cancel")) {
            resolve({ cancelled: true });
          } else {
            reject(new Error(failureReason || "The receipt could not be printed."));
          }
        },
      );
    });
  } finally {
    printWindow.destroy();
  }
}

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
  const captureDate = !app.isPackaged && /^\d{4}-\d{2}-\d{2}$/.test(process.env.SHORT_STAY_GUIDE_CAPTURE_DATE ?? "")
    ? process.env.SHORT_STAY_GUIDE_CAPTURE_DATE
    : undefined;
  businessSession = createBusinessSession({
    databasePath: path.join(app.getPath("userData"), "business.db"),
    credentialVault: createCredentialVault(
      safeStorage,
      path.join(app.getPath("userData"), "database-key.bin"),
    ),
    ...(captureDate ? {
      createRepository: (database) => createBusinessRepository(database, {
        now: () => new Date(`${captureDate}T12:00:00.000Z`),
      }),
    } : {}),
  });
  registerIpcHandlers(ipcMain, {
    ...createBusinessIpcHandlers(businessSession),
    [IPC_CHANNELS.BACKUP_CREATE]: async ({password}) => {
      const business=businessSession!.getSettings();const result=await dialog.showSaveDialog({title:"Create encrypted backup",defaultPath:`${business.name}-${new Date().toISOString().slice(0,10)}.staybooks`,filters:[{name:"StayBooks encrypted backup",extensions:["staybooks"]}]});if(result.canceled||!result.filePath)return{cancelled:true,path:null};await businessSession!.backupTo(result.filePath,password);return{cancelled:false,path:result.filePath};
    },
    [IPC_CHANNELS.BACKUP_RESTORE]: async ({password}) => {
      const result=await dialog.showOpenDialog({title:"Restore encrypted backup",properties:["openFile"],filters:[{name:"StayBooks encrypted backup",extensions:["staybooks","db"]}]});const source=result.filePaths[0];if(result.canceled||!source)return{cancelled:true,path:null};businessSession!.restoreFrom(source,password);return{cancelled:false,path:source};
    },
    [IPC_CHANNELS.EXPORT_EXCEL]: async ({month}) => {
      const business=businessSession!.getSettings();const result=await dialog.showSaveDialog({title:"Export Excel workbook",defaultPath:`${business.name}-${month}.xlsx`,filters:[{name:"Excel workbook",extensions:["xlsx"]}]});if(result.canceled||!result.filePath)return{cancelled:true,path:null};businessSession!.exportTo(result.filePath,month);return{cancelled:false,path:result.filePath};
    },
    [IPC_CHANNELS.RECEIPT_PRINT]: async ({ paymentId }) =>
      printReceipt(businessSession!.getReceipt(paymentId)),
  });
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => businessSession?.lock());

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
