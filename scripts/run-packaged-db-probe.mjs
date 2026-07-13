import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const productName = packageJson.productName;
const architecture = process.arch;
const packageDirectory = path.join(
  root,
  "out",
  `${productName}-${process.platform}-${architecture}`,
);

const application =
  process.platform === "darwin"
    ? path.join(packageDirectory, `${productName}.app`)
    : packageDirectory;
const resources =
  process.platform === "darwin"
    ? path.join(application, "Contents", "Resources")
    : path.join(application, "resources");
const executable =
  process.platform === "darwin"
    ? path.join(application, "Contents", "MacOS", productName)
    : path.join(
        application,
        process.platform === "win32" ? `${productName}.exe` : productName,
      );
const addon = path.join(
  resources,
  "app.asar.unpacked",
  "node_modules",
  "better-sqlite3-multiple-ciphers",
  "build",
  "Release",
  "better_sqlite3.node",
);
const probeBundle = path.join(
  resources,
  "app.asar",
  ".vite",
  "build",
  "packaged-probe.js",
);

for (const requiredPath of [executable, addon]) {
  if (!existsSync(requiredPath)) {
    throw new Error(`Packaged artifact is missing: ${requiredPath}`);
  }
}

const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "stay-books-package-probe-"));
const databasePath = path.join(temporaryDirectory, "probe.db");

try {
  const probe = spawnSync(executable, [probeBundle, databasePath], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  });
  if (probe.status !== 0) {
    throw new Error(
      `Packaged database probe failed (${probe.status}): ${probe.stderr || probe.stdout}`,
    );
  }

  const result = JSON.parse(probe.stdout.trim().split("\n").at(-1));
  const expectedElectronVersion = packageJson.devDependencies.electron;
  const expectedAbiByElectronMajor = { "43": "148" };
  const electronMajor = String(result.electronVersion).split(".")[0];
  const expectedAbi = expectedAbiByElectronMajor[electronMajor];

  if (result.electronVersion !== expectedElectronVersion) {
    throw new Error(
      `Expected Electron ${expectedElectronVersion}, received ${result.electronVersion}`,
    );
  }
  if (!expectedAbi || result.moduleAbi !== expectedAbi) {
    throw new Error(
      `Expected Electron ${electronMajor} module ABI ${expectedAbi}, received ${result.moduleAbi}`,
    );
  }
  if (!result.encryptedHeader || !result.wrongKeyRejected || result.persisted !== "ok") {
    throw new Error(`Packaged database assertions failed: ${JSON.stringify(result)}`);
  }

  const launchedAt = Date.now();
  const launchedApp = spawn(executable, [], { stdio: "ignore" });
  await new Promise((resolve) => setTimeout(resolve, 3000));
  if (launchedApp.exitCode !== null) {
    throw new Error(`Packaged app exited during launch smoke (${launchedApp.exitCode})`);
  }
  launchedApp.kill("SIGTERM");

  process.stdout.write(
    `${JSON.stringify({
      artifact: application,
      addon,
      addonBytes: statSync(addon).size,
      electronVersion: result.electronVersion,
      moduleAbi: result.moduleAbi,
      encryptedHeader: result.encryptedHeader,
      wrongKeyRejected: result.wrongKeyRejected,
      persisted: result.persisted,
      appLaunchMilliseconds: Date.now() - launchedAt,
    })}\n`,
  );
} finally {
  rmSync(temporaryDirectory, { force: true, recursive: true });
}
