import { afterEach, describe, expect, it, vi } from "vitest";

describe("product metadata", () => {
  afterEach(() => {
    vi.doUnmock("../../package.json");
    vi.resetModules();
  });

  it("derives the runtime product name from package.json", async () => {
    vi.doMock("../../package.json", () => ({
      default: { productName: "Renamed Accounts" },
    }));

    const { PRODUCT_NAME } = await import("../../src/shared/product");

    expect(PRODUCT_NAME).toBe("Renamed Accounts");
  });
});
