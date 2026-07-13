import { readFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

import { openEncryptedDatabase } from "./connection";

const databasePath = process.argv[2];
if (!databasePath || !path.isAbsolute(databasePath)) {
  throw new Error("The packaged database probe requires an absolute output path");
}

const key = `${randomBytes(32).toString("hex")}'probe`;
const database = openEncryptedDatabase(databasePath, key);
database.exec("insert into app_meta(key, value) values ('package_probe', 'ok')");
database.close();

let wrongKeyRejected = false;
try {
  openEncryptedDatabase(databasePath, "incorrect probe key").close();
} catch {
  wrongKeyRejected = true;
}

if (!wrongKeyRejected) {
  throw new Error("The encrypted database accepted an incorrect key");
}

const reopened = openEncryptedDatabase(databasePath, key);
const persisted = reopened
  .prepare<[], { value: string }>(
    "select value from app_meta where key = 'package_probe'",
  )
  .get()?.value;
reopened.close();

if (persisted !== "ok") {
  throw new Error("The encrypted database did not persist probe data");
}

process.stdout.write(
  `${JSON.stringify({
    electronVersion: process.versions.electron,
    moduleAbi: process.versions.modules,
    encryptedHeader:
      readFileSync(databasePath).subarray(0, 16).toString() !==
      "SQLite format 3\0",
    wrongKeyRejected,
    persisted,
  })}\n`,
);
