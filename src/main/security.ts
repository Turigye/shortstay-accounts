export function isAllowedNavigation(url: string): boolean {
  return url.startsWith("file://") || url.startsWith("http://localhost:");
}

export function applySecurityGuards(window: Electron.BrowserWindow): void {
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigation(url)) event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );
}
