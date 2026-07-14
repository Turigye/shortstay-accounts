import { spawnSync } from "node:child_process";
import path from "node:path";

import electron from "electron";

const vitest = path.join(process.cwd(), "node_modules", "vitest", "vitest.mjs");
const result = spawnSync(electron, [vitest, "run", ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
