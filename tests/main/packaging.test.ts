import { describe, expect, it } from "vitest";

import forgeConfig from "../../forge.config";
import viteMainConfig from "../../vite.main.config";

const RUNTIME_FILES = [
  "/node_modules/better-sqlite3-multiple-ciphers/lib/index.js",
  "/node_modules/better-sqlite3-multiple-ciphers/build/Release/better_sqlite3.node",
  "/node_modules/bindings/bindings.js",
  "/node_modules/file-uri-to-path/index.js",
] as const;

describe("packaged database runtime", () => {
  it("copies the native driver and each runtime dependency", () => {
    const ignore = forgeConfig.packagerConfig?.ignore;
    expect(ignore).toBeTypeOf("function");

    for (const file of RUNTIME_FILES) {
      expect((ignore as (path: string) => boolean)(file), file).toBe(false);
    }
    expect((ignore as (path: string) => boolean)("/.vite/build/main.js")).toBe(
      false,
    );
    expect((ignore as (path: string) => boolean)("/src/domain/money.ts")).toBe(
      true,
    );
  });

  it("externalizes the native driver from the main Vite bundle", () => {
    const external = viteMainConfig.build?.rollupOptions?.external;

    expect(external).toEqual(
      expect.arrayContaining(["better-sqlite3-multiple-ciphers"]),
    );
  });

  it("builds a separate packaged database probe without changing the app entry", () => {
    const vitePlugin = forgeConfig.plugins?.find(
      (plugin) => plugin.name === "vite",
    ) as unknown as {
      config: { build: Array<{ entry: string; target: string }> };
    };

    expect(vitePlugin.config.build).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entry: "src/main/db/packaged-probe.ts",
          target: "main",
        }),
      ]),
    );
  });
});
