export function isAllowedNavigation(url: string): boolean {
  return url.startsWith("file://") || url.startsWith("http://localhost:");
}

export function contentSecurityPolicyFor(url: string): string {
  const isViteDevelopment = url.startsWith("http://localhost:");

  return [
    "default-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src 'self'${isViteDevelopment ? " 'unsafe-inline'" : ""}`,
    `style-src 'self'${isViteDevelopment ? " 'unsafe-inline'" : ""}`,
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${isViteDevelopment ? " ws://localhost:*" : ""}`,
  ].join("; ");
}

export function applySecurityGuards(window: Electron.BrowserWindow): void {
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigation(url)) event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );
  window.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [contentSecurityPolicyFor(details.url)],
      },
    });
  });
}
