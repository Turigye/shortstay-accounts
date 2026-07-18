import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  CredentialVaultError,
  createCredentialVault,
} from "../../src/main/credential-vault";

const directories: string[] = [];

function vaultPath(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "staybooks-vault-"));
  directories.push(directory);
  return path.join(directory, "database-key.bin");
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

describe("credential vault", () => {
  it("stores only an OS-encrypted database secret", () => {
    const filePath = vaultPath();
    const safeStorage = {
      isEncryptionAvailable: () => true,
      encryptString: (value: string) =>
        Buffer.from([...value].reverse().join(""), "utf8"),
      decryptString: (value: Buffer) =>
        [...value.toString("utf8")].reverse().join(""),
    };
    const vault = createCredentialVault(safeStorage, filePath);

    vault.save("correct database password");

    expect(vault.load()).toBe("correct database password");
    expect(readFileSync(filePath, "utf8")).not.toContain("correct database password");
  });

  it("returns null when no saved secret exists", () => {
    const vault = createCredentialVault({
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from(value),
      decryptString: (value) => value.toString(),
    }, vaultPath());

    expect(vault.load()).toBeNull();
  });

  it("clears corrupt storage and reports unavailable OS encryption", () => {
    const filePath = vaultPath();
    const unavailable = createCredentialVault({
      isEncryptionAvailable: () => false,
      encryptString: (value) => Buffer.from(value),
      decryptString: (value) => value.toString(),
    }, filePath);

    expect(() => unavailable.save("secret")).toThrowError(
      expect.objectContaining<Partial<CredentialVaultError>>({ code: "UNAVAILABLE" }),
    );
  });
});
