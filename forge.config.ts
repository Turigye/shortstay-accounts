import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { VitePlugin } from "@electron-forge/plugin-vite";

const PACKAGED_RUNTIME_ROOTS = [
  "/.vite",
  "/node_modules/better-sqlite3-multiple-ciphers",
  "/node_modules/bindings",
  "/node_modules/file-uri-to-path",
] as const;

function ignorePackagedFile(file: string): boolean {
  if (!file || file === "/node_modules") return false;
  return !PACKAGED_RUNTIME_ROOTS.some(
    (root) => file === root || file.startsWith(`${root}/`),
  );
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: "assets/app-icon",
    ignore: ignorePackagedFile,
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      setupIcon: "assets/app-icon.ico",
    }),
    new MakerZIP({}, ["darwin", "win32"]),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          entry: "src/main/main.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/main/db/packaged-probe.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/preload/index.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
      ],
    }),
  ],
};

export default config;
