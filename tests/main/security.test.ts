import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applySecurityGuards,
  contentSecurityPolicyFor,
  isAllowedNavigation,
} from "../../src/main/security";

const setWindowOpenHandler = vi.fn();
const on = vi.fn();
const setPermissionRequestHandler = vi.fn();
const onHeadersReceived = vi.fn();

const browserWindow = {
  webContents: {
    setWindowOpenHandler,
    on,
    session: {
      setPermissionRequestHandler,
      webRequest: { onHeadersReceived },
    },
  },
} as unknown as Electron.BrowserWindow;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isAllowedNavigation", () => {
  it("allows the packaged app origin and blocks remote navigation", () => {
    expect(isAllowedNavigation("file:///Applications/StayBooks/index.html")).toBe(true);
    expect(isAllowedNavigation("https://example.com/phishing")).toBe(false);
  });
});

describe("contentSecurityPolicyFor", () => {
  it("uses a locked policy for packaged files", () => {
    const policy = contentSecurityPolicyFor("file:///Applications/StayBooks/index.html");

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("connect-src 'self'");
    expect(policy).not.toContain("localhost");
    expect(policy).not.toContain("ws:");
  });

  it("allows only localhost websocket connections needed by Vite development", () => {
    const policy = contentSecurityPolicyFor("http://localhost:5173/");

    expect(policy).toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).toContain("connect-src 'self' ws://localhost:*");
    expect(policy).not.toContain("http://*");
    expect(policy).not.toContain("https://*");
    expect(policy).not.toContain("ws://*");
  });
});

describe("applySecurityGuards", () => {
  it("denies popup windows", () => {
    applySecurityGuards(browserWindow);

    const handler = setWindowOpenHandler.mock.calls[0]?.[0];
    expect(handler()).toEqual({ action: "deny" });
  });

  it("prevents remote navigation", () => {
    applySecurityGuards(browserWindow);

    const handler = on.mock.calls.find(([eventName]) => eventName === "will-navigate")?.[1];
    const event = { preventDefault: vi.fn() };
    handler(event, "https://example.com/phishing");
    expect(event.preventDefault).toHaveBeenCalledOnce();

    event.preventDefault.mockClear();
    handler(event, "http://localhost:5173/");
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("denies permission requests", () => {
    applySecurityGuards(browserWindow);

    const handler = setPermissionRequestHandler.mock.calls[0]?.[0];
    const callback = vi.fn();
    handler(undefined, "media", callback);
    expect(callback).toHaveBeenCalledWith(false);
  });

  it("injects the policy without dropping existing response headers", () => {
    applySecurityGuards(browserWindow);

    const handler = onHeadersReceived.mock.calls[0]?.[0];
    const callback = vi.fn();
    handler(
      {
        url: "file:///Applications/StayBooks/index.html",
        responseHeaders: { "X-Existing": ["preserved"] },
      },
      callback,
    );

    expect(callback).toHaveBeenCalledWith({
      responseHeaders: {
        "X-Existing": ["preserved"],
        "Content-Security-Policy": [
          expect.stringContaining("default-src 'self'"),
        ],
      },
    });
  });

  it("allows only inline styling for isolated print documents", () => {
    expect(contentSecurityPolicyFor("data:text/html;charset=utf-8,receipt")).toContain(
      "style-src 'unsafe-inline'",
    );
    expect(contentSecurityPolicyFor("data:text/html;charset=utf-8,receipt")).toContain(
      "script-src 'none'",
    );
  });
});
