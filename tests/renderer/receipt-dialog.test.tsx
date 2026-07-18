// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ReceiptDialog } from "../../src/renderer/components/ReceiptDialog";
import type { ReceiptDocument } from "../../src/main/receipt-service";

const receipt: ReceiptDocument = {
  paymentId: "payment-1",
  reference: "RCT-20260718-ABC123",
  businessName: "Eden Grove",
  paidAt: "2026-07-18T09:30:00.000Z",
  guestName: "Amina Kato",
  guestPhone: "+256 700 123456",
  unitName: "Garden Studio",
  occupancyMode: "one_room",
  checkIn: "2026-07-20",
  checkOut: "2026-07-23",
  amount: 150_000,
  amountWords: "One hundred fifty thousand Uganda shillings only",
  method: "Cash",
  accountName: "Front Desk Cash",
  externalReference: "CASH-001",
  bookingTotal: 300_000,
  receivedAfter: 150_000,
  remainingBalance: 150_000,
  receivedBy: "Front Desk",
  receivedByUserId: "editor-1",
  reversed: false,
};

describe("ReceiptDialog", () => {
  it("shows receipt essentials and prints through the provided action", async () => {
    const onPrint = vi.fn(async () => undefined);
    const user = userEvent.setup();
    render(<ReceiptDialog receipt={receipt} onClose={vi.fn()} onPrint={onPrint} />);

    expect(screen.getByText("RCT-20260718-ABC123")).toBeTruthy();
    expect(screen.getAllByText("UGX 150,000")).toHaveLength(2);
    expect(screen.getByText("Amina Kato")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Print receipt" }));
    expect(onPrint).toHaveBeenCalledWith("payment-1");
  });
});
