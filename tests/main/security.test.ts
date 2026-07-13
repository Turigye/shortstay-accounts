import { describe, expect, it, vi } from "vitest";
import { isAllowedNavigation } from "../../src/main/security";

describe("isAllowedNavigation", () => {
  it("allows the packaged app origin and blocks remote navigation", () => {
    expect(isAllowedNavigation("file:///Applications/StayBooks/index.html")).toBe(true);
    expect(isAllowedNavigation("https://example.com/phishing")).toBe(false);
  });
});
