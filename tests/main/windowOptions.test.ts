import { describe, expect, it } from "vitest";

import { createBrowserWindowOptions } from "../../src/main/windowOptions";
import { PRODUCT_NAME } from "../../src/shared/product";

describe("main window options", () => {
  it("uses the shared runtime product name", () => {
    const options = createBrowserWindowOptions("/app/preload.js");

    expect(options.title).toBe(PRODUCT_NAME);
    expect(options.webPreferences?.preload).toBe("/app/preload.js");
  });
});
