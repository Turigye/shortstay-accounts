import { describe, expect, it } from "vitest";

import { capabilitiesFor, hasCapability } from "../../src/domain/users";

describe("user capabilities", () => {
  it("gives an Admin unrestricted application access", () => {
    expect(capabilitiesFor("admin")).toEqual(["admin.all"]);
    expect(hasCapability("admin", "payment.refund")).toBe(true);
    expect(hasCapability("admin", "users.manage")).toBe(true);
  });

  it("limits an Editor to operational booking and receipt work", () => {
    expect(capabilitiesFor("editor")).toEqual([
      "booking.read",
      "booking.create",
      "booking.update",
      "booking.progress",
      "payment.read",
      "payment.receipt",
      "receipt.print",
    ]);
    expect(hasCapability("editor", "payment.receipt")).toBe(true);
    expect(hasCapability("editor", "payment.refund")).toBe(false);
    expect(hasCapability("editor", "booking.cancel")).toBe(false);
    expect(hasCapability("editor", "users.manage")).toBe(false);
  });
});
