import type { AuthenticatedUser, Capability } from "../domain/users";
import { hasCapability } from "../domain/users";

export class AuthorizationError extends Error {
  constructor(
    readonly code: "AUTHENTICATION_REQUIRED" | "FORBIDDEN",
    message: string,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function assertCapability(
  user: AuthenticatedUser | null,
  capability: Capability,
): void {
  if (!user) {
    throw new AuthorizationError(
      "AUTHENTICATION_REQUIRED",
      "Sign in to continue.",
    );
  }
  if (!hasCapability(user.role, capability)) {
    throw new AuthorizationError(
      "FORBIDDEN",
      "Your profile cannot perform this action.",
    );
  }
}
