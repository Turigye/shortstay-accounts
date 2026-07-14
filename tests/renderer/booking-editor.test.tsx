// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Booking, Customer } from "../../src/domain/bookings";
import type { BusinessUnit, Ugx } from "../../src/domain/types";
import { BookingEditor } from "../../src/renderer/components/BookingEditor";
import { UnitSchedule } from "../../src/renderer/components/UnitSchedule";
import { BookingsScreen } from "../../src/renderer/screens/BookingsScreen";
import { IPC_CHANNELS } from "../../src/shared/ipc";

const units: BusinessUnit[] = [
  { id: "unit-1", name: "Lake View", status: "active" },
  { id: "unit-2", name: "Garden Suite", status: "active" },
];

const customers: Customer[] = [
  {
    id: "customer-1",
    businessId: "business-1",
    name: "Amina N.",
    phone: "+256 700 123456",
    email: "amina@example.com",
    notes: null,
    archived: false,
  },
];

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "booking-1",
    businessId: "business-1",
    unitId: "unit-1",
    unitName: "Lake View",
    customerId: "customer-1",
    customerName: "Amina N.",
    customerPhone: "+256 700 123456",
    customerEmail: "amina@example.com",
    referrerId: null,
    referrerName: null,
    checkIn: "2026-07-20",
    checkOut: "2026-07-22",
    checkInTime: "14:00",
    checkOutTime: "11:00",
    nights: 2,
    nightlyRate: 180_000 as Ugx,
    adjustment: 0 as Ugx,
    total: 360_000 as Ugx,
    status: "confirmed",
    paymentState: "unpaid",
    received: 0 as Ugx,
    balance: 360_000 as Ugx,
    notes: null,
    createdAt: "2026-07-14T09:00:00.000Z",
    updatedAt: "2026-07-14T09:00:00.000Z",
    ...overrides,
  };
}

afterEach(cleanup);

describe("BookingEditor", () => {
  it("calculates checkout-exclusive nights and total live", async () => {
    render(
      <BookingEditor
        customers={customers}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        units={units}
      />,
    );
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("Unit"), "unit-1");
    await user.selectOptions(screen.getByLabelText("Customer"), "customer-1");
    fireEvent.change(screen.getByLabelText("Check-in date"), {
      target: { value: "2026-07-10" },
    });
    fireEvent.change(screen.getByLabelText("Check-out date"), {
      target: { value: "2026-07-13" },
    });
    await user.type(screen.getByLabelText("Nightly rate"), "180000");
    await user.click(screen.getByText("Advanced booking details"));
    await user.clear(screen.getByLabelText("Adjustment"));
    await user.type(screen.getByLabelText("Adjustment"), "-20000");

    const summary = screen.getByLabelText("Booking total");
    expect(within(summary).getByText("3 nights")).toBeTruthy();
    expect(within(summary).getByText("UGX 520,000")).toBeTruthy();
  });

  it("keeps a nonzero initial payment visible and returns field-level validation", async () => {
    const onSave = vi.fn();
    render(
      <BookingEditor customers={customers} onCancel={vi.fn()} onSave={onSave} units={units} />,
    );
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("Unit"), "unit-1");
    await user.selectOptions(screen.getByLabelText("Customer"), "customer-1");
    fireEvent.change(screen.getByLabelText("Check-in date"), {
      target: { value: "2026-07-20" },
    });
    fireEvent.change(screen.getByLabelText("Check-out date"), {
      target: { value: "2026-07-22" },
    });
    await user.type(screen.getByLabelText("Nightly rate"), "180000");
    await user.click(screen.getByText("Advanced booking details"));
    await user.clear(screen.getByLabelText("Initial payment"));
    await user.type(screen.getByLabelText("Initial payment"), "100000");
    await user.type(screen.getByLabelText("Payment reference"), "MM-4421");
    await user.click(screen.getByRole("button", { name: "Save booking" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText<HTMLInputElement>("Initial payment").value).toBe("100000");
    expect(screen.getByLabelText<HTMLInputElement>("Payment reference").value).toBe("MM-4421");
    expect(screen.getByText(/record this payment after saving the booking/i)).toBeTruthy();
  });

  it("saves a booking without payment as confirmed", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <BookingEditor customers={customers} onCancel={vi.fn()} onSave={onSave} units={units} />,
    );
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("Unit"), "unit-2");
    await user.selectOptions(screen.getByLabelText("Customer"), "customer-1");
    fireEvent.change(screen.getByLabelText("Check-in date"), {
      target: { value: "2026-07-20" },
    });
    fireEvent.change(screen.getByLabelText("Check-out date"), {
      target: { value: "2026-07-22" },
    });
    await user.type(screen.getByLabelText("Nightly rate"), "180000");
    await user.click(screen.getByRole("button", { name: "Save booking" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        unitId: "unit-2",
        customerId: "customer-1",
        checkIn: "2026-07-20",
        checkOut: "2026-07-22",
        nightlyRate: 180_000,
        status: "confirmed",
      }),
    );
  });

  it("does not silently discard a referrer name when referral is unchecked", async () => {
    const onSave = vi.fn();
    render(
      <BookingEditor customers={customers} onCancel={vi.fn()} onSave={onSave} units={units} />,
    );
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("Unit"), "unit-1");
    await user.selectOptions(screen.getByLabelText("Customer"), "customer-1");
    fireEvent.change(screen.getByLabelText("Check-in date"), {
      target: { value: "2026-07-20" },
    });
    fireEvent.change(screen.getByLabelText("Check-out date"), {
      target: { value: "2026-07-22" },
    });
    await user.type(screen.getByLabelText("Nightly rate"), "180000");
    await user.click(screen.getByText("Advanced booking details"));
    await user.click(screen.getByRole("checkbox", { name: "Referral booking" }));
    await user.type(screen.getByLabelText("Referrer"), "Kato Travel");
    await user.click(screen.getByRole("checkbox", { name: "Referral booking" }));
    await user.click(screen.getByRole("button", { name: "Save booking" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText<HTMLInputElement>("Referrer").value).toBe("Kato Travel");
    expect(screen.getByText(/remove the referrer name or mark this as a referral booking/i)).toBeTruthy();
  });

  it("creates a customer before saving a manual booking", async () => {
    const newCustomer = { ...customers[0], id: "customer-2", name: "Brian K." };
    const onCreateCustomer = vi.fn().mockResolvedValue(newCustomer);
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <BookingEditor
        customers={customers}
        onCancel={vi.fn()}
        onCreateCustomer={onCreateCustomer}
        onSave={onSave}
        units={units}
      />,
    );
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText("Unit"), "unit-1");
    await user.selectOptions(screen.getByLabelText("Customer"), "new");
    await user.type(screen.getByLabelText("Customer name"), "Brian K.");
    await user.type(screen.getByLabelText("Phone"), "+256 755 000111");
    fireEvent.change(screen.getByLabelText("Check-in date"), {
      target: { value: "2026-07-20" },
    });
    fireEvent.change(screen.getByLabelText("Check-out date"), {
      target: { value: "2026-07-22" },
    });
    await user.type(screen.getByLabelText("Nightly rate"), "180000");
    await user.click(screen.getByRole("button", { name: "Save booking" }));

    expect(onCreateCustomer).toHaveBeenCalledWith({
      name: "Brian K.",
      phone: "+256 755 000111",
      email: null,
    });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ customerId: "customer-2" }));
  });

  it.each(["conflict response", "unexpected rejection"])(
    "reuses the persisted customer when booking creation fails with %s",
    async (failureMode) => {
      const newCustomer = { ...customers[0], id: "customer-2", name: "Brian K." };
      const onCreateCustomer = vi.fn().mockResolvedValue(newCustomer);
      const onSave =
        failureMode === "unexpected rejection"
          ? vi.fn().mockRejectedValueOnce(new Error("booking write failed")).mockResolvedValueOnce(undefined)
          : vi.fn().mockResolvedValue(undefined);
      render(
        <BookingEditor
          customers={customers}
          onCancel={vi.fn()}
          onCreateCustomer={onCreateCustomer}
          onSave={onSave}
          units={units}
        />,
      );
      const user = userEvent.setup();

      await user.selectOptions(screen.getByLabelText("Unit"), "unit-1");
      await user.selectOptions(screen.getByLabelText("Customer"), "new");
      await user.type(screen.getByLabelText("Customer name"), "Brian K.");
      await user.type(screen.getByLabelText("Phone"), "+256 755 000111");
      fireEvent.change(screen.getByLabelText("Check-in date"), {
        target: { value: "2026-07-20" },
      });
      fireEvent.change(screen.getByLabelText("Check-out date"), {
        target: { value: "2026-07-22" },
      });
      await user.type(screen.getByLabelText("Nightly rate"), "180000");
      await user.click(screen.getByRole("button", { name: "Save booking" }));
      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
      await user.click(screen.getByRole("button", { name: "Save booking" }));
      await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));

      expect(onCreateCustomer).toHaveBeenCalledOnce();
      expect(onSave).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ customerId: "customer-2" }),
      );
    },
  );
});

describe("UnitSchedule", () => {
  it("renders adjacent bookings as separate keyboard-accessible controls", async () => {
    const onSelectBooking = vi.fn();
    render(
      <UnitSchedule
        bookings={[
          booking(),
          booking({
            id: "booking-2",
            customerName: "Brian K.",
            checkIn: "2026-07-22",
            checkOut: "2026-07-24",
          }),
        ]}
        days={5}
        onCreateBooking={vi.fn()}
        onSelectBooking={onSelectBooking}
        startDate="2026-07-20"
        units={units}
      />,
    );
    const user = userEvent.setup();

    const first = screen.getByRole("button", { name: /Amina N.*Lake View.*Jul 20.*Jul 22/i });
    const second = screen.getByRole("button", { name: /Brian K.*Lake View.*Jul 22.*Jul 24/i });
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    first.focus();
    await user.keyboard("{Enter}");
    expect(onSelectBooking).toHaveBeenCalledWith(expect.objectContaining({ id: "booking-1" }));
  });
});

describe("BookingsScreen", () => {
  it("opens one shared booking editor from both Schedule and List", async () => {
    const invoke = vi.fn(async (channel: string) => {
      if (channel === IPC_CHANNELS.CUSTOMERS_LIST) return { ok: true, data: customers };
      if (channel === IPC_CHANNELS.BOOKINGS_LIST) return { ok: true, data: [booking()] };
      throw new Error(`Unexpected channel ${channel}`);
    });
    Object.defineProperty(window, "stayBooks", {
      configurable: true,
      value: { invoke },
    });
    render(<BookingsScreen today="2026-07-20" units={units} />);
    const user = userEvent.setup();

    const scheduleBooking = await screen.findByRole("button", {
      name: /Amina N.*Lake View.*Jul 20.*Jul 22/i,
    });
    await user.click(scheduleBooking);
    expect(screen.getByLabelText("Booking details")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Close booking editor" }));

    await user.click(screen.getByRole("tab", { name: "List" }));
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Unit" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Customer" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Stay" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Total" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Balance" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Open booking for Amina N." }));
    expect(screen.getByLabelText("Booking details")).toBeTruthy();

    await waitFor(() => expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.BOOKINGS_LIST, {}));
  });
});
