import { describe, expect, it } from "vitest";

import type { AuthenticatedUser } from "../../src/domain/users";
import {
  AuthorizationError,
  assertCapability,
} from "../../src/main/authorization";

const admin: AuthenticatedUser = {
  id: "admin-1",
  name: "Owner",
  username: "admin",
  role: "admin",
};
const editor: AuthenticatedUser = {
  id: "editor-1",
  name: "Front Desk",
  username: "desk",
  role: "editor",
};

describe("authorization", () => {
  it("allows Admins to perform any defined operation", () => {
    expect(() => assertCapability(admin, "payment.refund")).not.toThrow();
    expect(() => assertCapability(admin, "users.manage")).not.toThrow();
  });

  it("allows only listed Editor capabilities", () => {
    expect(() => assertCapability(editor, "payment.receipt")).not.toThrow();
    expect(() => assertCapability(editor, "payment.refund")).toThrowError(
      expect.objectContaining<Partial<AuthorizationError>>({ code: "FORBIDDEN" }),
    );
  });

  it("rejects operations without an authenticated profile", () => {
    expect(() => assertCapability(null, "booking.read")).toThrowError(
      expect.objectContaining<Partial<AuthorizationError>>({ code: "AUTHENTICATION_REQUIRED" }),
    );
  });
});
