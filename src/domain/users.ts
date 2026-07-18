export const USER_ROLES = ["admin", "editor"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type Capability =
  | "admin.all"
  | "booking.read"
  | "booking.create"
  | "booking.update"
  | "booking.progress"
  | "booking.cancel"
  | "booking.archive"
  | "payment.read"
  | "payment.receipt"
  | "payment.refund"
  | "payment.correct"
  | "payment.reverse"
  | "receipt.print"
  | "users.manage";

export interface AuthenticatedUser {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly role: UserRole;
}

export interface UserProfile extends AuthenticatedUser {
  readonly active: boolean;
}

const EDITOR_CAPABILITIES = [
  "booking.read",
  "booking.create",
  "booking.update",
  "booking.progress",
  "payment.read",
  "payment.receipt",
  "receipt.print",
] as const satisfies readonly Capability[];

export function capabilitiesFor(role: UserRole): readonly Capability[] {
  return role === "admin" ? ["admin.all"] : EDITOR_CAPABILITIES;
}

export function hasCapability(
  role: UserRole,
  capability: Capability,
): boolean {
  const capabilities = capabilitiesFor(role);
  return capabilities.includes("admin.all") ||
    capabilities.includes(capability);
}
