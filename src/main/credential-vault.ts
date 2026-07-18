import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

export interface SafeStorageAdapter {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}

export interface CredentialVault {
  load(): string | null;
  save(secret: string): void;
  clear(): void;
}

export class CredentialVaultError extends Error {
  constructor(readonly code: "UNAVAILABLE" | "INVALID_SECRET", message: string) {
    super(message);
    this.name = "CredentialVaultError";
  }
}

export function createCredentialVault(
  safeStorage: SafeStorageAdapter,
  filePath: string,
): CredentialVault {
  return Object.freeze({
    load(): string | null {
      if (!existsSync(filePath) || !safeStorage.isEncryptionAvailable()) {
        return null;
      }
      try {
        const secret = safeStorage.decryptString(readFileSync(filePath));
        if (!secret) throw new Error("empty secret");
        return secret;
      } catch {
        rmSync(filePath, { force: true });
        return null;
      }
    },

    save(secret: string): void {
      if (!secret) {
        throw new CredentialVaultError(
          "INVALID_SECRET",
          "The database secret cannot be empty.",
        );
      }
      if (!safeStorage.isEncryptionAvailable()) {
        throw new CredentialVaultError(
          "UNAVAILABLE",
          "Secure operating-system storage is unavailable.",
        );
      }
      writeFileSync(filePath, safeStorage.encryptString(secret), { mode: 0o600 });
    },

    clear(): void {
      rmSync(filePath, { force: true });
    },
  });
}
