import { ChevronDown, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  BookingRuleError,
  calculateBookingTotal,
  calculateNights,
  type Booking,
  type Customer,
} from "../../domain/bookings";
import type { BookingStatus, BusinessUnit } from "../../domain/types";

export interface BookingEditorValue {
  readonly unitId: string;
  readonly customerId: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly checkInTime: string;
  readonly checkOutTime: string;
  readonly nightlyRate: number;
  readonly adjustment: number;
  readonly status: BookingStatus;
  readonly referred: boolean;
  readonly referrerName: string | null;
  readonly notes: string | null;
}

export interface NewCustomerValue {
  readonly name: string;
  readonly phone: string;
  readonly email: string | null;
}

interface BookingEditorProps {
  units: readonly BusinessUnit[];
  customers: readonly Customer[];
  booking?: Booking | null;
  initialUnitId?: string;
  initialCheckIn?: string;
  busy?: boolean;
  error?: string | null;
  fieldErrors?: Readonly<Record<string, readonly string[]>>;
  onSave: (input: BookingEditorValue) => void | Promise<void>;
  onCreateCustomer?: (input: NewCustomerValue) => Customer | Promise<Customer>;
  onCancel: () => void;
  onTransition?: (status: BookingStatus) => void | Promise<void>;
}

interface FormState {
  unitId: string;
  customerId: string;
  customerName: string;
  phone: string;
  email: string;
  checkIn: string;
  checkOut: string;
  checkInTime: string;
  checkOutTime: string;
  nightlyRate: string;
  adjustment: string;
  status: "draft" | "confirmed";
  referred: boolean;
  referrerName: string;
  initialPayment: string;
  paymentDate: string;
  paymentMethod: "cash" | "mobile_money" | "bank_transfer" | "card";
  paymentReference: string;
  notes: string;
}

function addOneDay(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function initialState(
  booking?: Booking | null,
  initialUnitId = "",
  initialCheckIn = "",
): FormState {
  return {
    unitId: booking?.unitId ?? initialUnitId,
    customerId: booking?.customerId ?? "",
    customerName: "",
    phone: "",
    email: "",
    checkIn: booking?.checkIn ?? initialCheckIn,
    checkOut: booking?.checkOut ?? (initialCheckIn ? addOneDay(initialCheckIn) : ""),
    checkInTime: booking?.checkInTime ?? "14:00",
    checkOutTime: booking?.checkOutTime ?? "11:00",
    nightlyRate: booking ? String(booking.nightlyRate) : "",
    adjustment: booking ? String(booking.adjustment) : "0",
    status: booking?.status === "draft" ? "draft" : "confirmed",
    referred: booking?.referrerId !== null && booking?.referrerId !== undefined,
    referrerName: booking?.referrerName ?? "",
    initialPayment: "0",
    paymentDate: booking?.checkIn ?? "",
    paymentMethod: "cash",
    paymentReference: "",
    notes: booking?.notes ?? "",
  };
}

function formatUgx(value: number): string {
  return `UGX ${new Intl.NumberFormat("en-UG").format(value)}`;
}

function parseWholeUgx(value: string): number | null {
  if (!/^-?\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function nextStatuses(status: BookingStatus): readonly BookingStatus[] {
  if (status === "draft") return ["confirmed", "cancelled"];
  if (status === "confirmed") return ["checkedIn", "cancelled"];
  if (status === "checkedIn") return ["completed", "cancelled"];
  return [];
}

const transitionLabels: Readonly<Record<BookingStatus, string>> = {
  draft: "Draft",
  confirmed: "Confirm",
  checkedIn: "Check in",
  completed: "Complete",
  cancelled: "Cancel booking",
};

export function BookingEditor({
  units,
  customers,
  booking,
  initialUnitId,
  initialCheckIn,
  busy = false,
  error,
  fieldErrors: serverFieldErrors = {},
  onSave,
  onCreateCustomer,
  onCancel,
  onTransition,
}: BookingEditorProps) {
  const [form, setForm] = useState<FormState>(() =>
    initialState(booking, initialUnitId, initialCheckIn),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  useEffect(() => {
    setForm(initialState(booking, initialUnitId, initialCheckIn));
    setFieldErrors({});
    setSubmissionError(null);
  }, [booking, initialCheckIn, initialUnitId]);

  const calculation = useMemo(() => {
    const nightlyRate = parseWholeUgx(form.nightlyRate);
    const adjustment = parseWholeUgx(form.adjustment);
    if (!form.checkIn || !form.checkOut || nightlyRate === null || adjustment === null) {
      return { nights: 0, total: 0, error: null };
    }
    try {
      const nights = calculateNights({ checkIn: form.checkIn, checkOut: form.checkOut });
      const total = calculateBookingTotal({ nights, nightlyRate, adjustment });
      return { nights, total, error: null };
    } catch (calculationError) {
      return {
        nights: 0,
        total: 0,
        error:
          calculationError instanceof BookingRuleError
            ? calculationError.message
            : "Check the booking dates and amounts.",
      };
    }
  }, [form.adjustment, form.checkIn, form.checkOut, form.nightlyRate]);

  function update<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function errorFor(field: string): string | undefined {
    return fieldErrors[field] ?? serverFieldErrors[field]?.[0];
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmissionError(null);
    const errors: Record<string, string> = {};
    if (!form.unitId) errors.unitId = "Choose a unit.";
    if (!form.customerId) errors.customerId = "Choose a customer or add a new one.";
    if (form.customerId === "new") {
      if (!form.customerName.trim()) errors.customerName = "Enter the customer's name.";
      if (!form.phone.trim()) errors.phone = "Enter the customer's phone number.";
      if (!onCreateCustomer) errors.customerId = "Customer creation is unavailable.";
    }
    if (!form.checkIn) errors.checkIn = "Choose a check-in date.";
    if (!form.checkOut) errors.checkOut = "Choose a check-out date.";
    const nightlyRate = parseWholeUgx(form.nightlyRate);
    const adjustment = parseWholeUgx(form.adjustment);
    if (nightlyRate === null || nightlyRate < 0) {
      errors.nightlyRate = "Enter a whole UGX amount of zero or more.";
    }
    if (adjustment === null) errors.adjustment = "Enter a whole UGX amount.";
    if (calculation.error) errors.checkOut = calculation.error;
    if (form.referred && !form.referrerName.trim()) {
      errors.referrerName = "Enter who referred this booking.";
    } else if (!form.referred && form.referrerName.trim()) {
      errors.referrerName =
        "Remove the referrer name or mark this as a referral booking.";
    }
    const initialPayment = parseWholeUgx(form.initialPayment);
    if (initialPayment === null || initialPayment < 0) {
      errors.initialPayment = "Enter a whole UGX amount of zero or more.";
    } else if (initialPayment > 0) {
      errors.initialPayment =
        "Record this payment after saving the booking so it is posted to a payment account.";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    let customerId = form.customerId;
    if (customerId === "new" && onCreateCustomer) {
      const customer = await onCreateCustomer({
        name: form.customerName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
      });
      customerId = customer.id;
      setForm((current) => ({ ...current, customerId: customer.id }));
    }
    try {
      await onSave({
        unitId: form.unitId,
        customerId,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        checkInTime: form.checkInTime,
        checkOutTime: form.checkOutTime,
        nightlyRate: nightlyRate!,
        adjustment: adjustment!,
        status: booking?.status ?? form.status,
        referred: form.referred,
        referrerName: form.referrerName.trim() || null,
        notes: form.notes.trim() || null,
      });
    } catch {
      setSubmissionError("The booking could not be saved. Review the details and try again.");
    }
  }

  return (
    <aside className="booking-editor" aria-label={booking ? "Booking details" : "New booking"}>
      <header className="booking-editor-header">
        <div>
          <h2>{booking ? booking.customerName : "New booking"}</h2>
          <p>{booking ? `${booking.unitName} · ${booking.checkIn} to ${booking.checkOut}` : "Manual entry"}</p>
        </div>
        <button aria-label="Close booking editor" className="icon-button" onClick={onCancel} type="button">
          <X aria-hidden="true" size={17} />
        </button>
      </header>

      <form className="booking-form" onSubmit={(event) => void handleSubmit(event)}>
        {error || submissionError ? (
          <p className="form-alert">{error ?? submissionError}</p>
        ) : null}
        <div className="booking-form-grid">
          <div className="field-group" data-invalid={Boolean(errorFor("unitId"))}>
            <label htmlFor="booking-unit">Unit</label>
            <select
              aria-invalid={Boolean(errorFor("unitId"))}
              id="booking-unit"
              onChange={(event) => update("unitId", event.target.value)}
              value={form.unitId}
            >
              <option value="">Choose unit</option>
              {units.filter(({ status }) => status === "active").map((unit) => (
                <option key={unit.id} value={unit.id}>{unit.name}</option>
              ))}
            </select>
            {errorFor("unitId") ? <small className="field-error">{errorFor("unitId")}</small> : null}
          </div>

          <div className="field-group" data-invalid={Boolean(errorFor("customerId"))}>
            <label htmlFor="booking-customer">Customer</label>
            <select
              aria-invalid={Boolean(errorFor("customerId"))}
              id="booking-customer"
              onChange={(event) => update("customerId", event.target.value)}
              value={form.customerId}
            >
              <option value="">Choose customer</option>
              {customers.filter(({ archived }) => !archived).map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name} · {customer.phone}</option>
              ))}
              {!booking ? <option value="new">+ New customer</option> : null}
            </select>
            {errorFor("customerId") ? <small className="field-error">{errorFor("customerId")}</small> : null}
          </div>
        </div>

        {form.customerId === "new" ? (
          <fieldset className="customer-inline-fields">
            <legend><Plus aria-hidden="true" size={14} /> Customer contact</legend>
            <div className="field-group" data-invalid={Boolean(errorFor("customerName"))}>
              <label htmlFor="customer-name">Customer name</label>
              <input id="customer-name" onChange={(event) => update("customerName", event.target.value)} value={form.customerName} />
              {errorFor("customerName") ? <small className="field-error">{errorFor("customerName")}</small> : null}
            </div>
            <div className="field-group" data-invalid={Boolean(errorFor("phone"))}>
              <label htmlFor="customer-phone">Phone</label>
              <input id="customer-phone" onChange={(event) => update("phone", event.target.value)} type="tel" value={form.phone} />
              {errorFor("phone") ? <small className="field-error">{errorFor("phone")}</small> : null}
            </div>
            <div className="field-group">
              <label htmlFor="customer-email">Email <span>(optional)</span></label>
              <input id="customer-email" onChange={(event) => update("email", event.target.value)} type="email" value={form.email} />
            </div>
          </fieldset>
        ) : null}

        <div className="booking-form-grid booking-date-grid">
          <div className="field-group" data-invalid={Boolean(errorFor("checkIn"))}>
            <label htmlFor="booking-check-in">Check-in date</label>
            <input id="booking-check-in" onChange={(event) => update("checkIn", event.target.value)} type="date" value={form.checkIn} />
            {errorFor("checkIn") ? <small className="field-error">{errorFor("checkIn")}</small> : null}
          </div>
          <div className="field-group" data-invalid={Boolean(errorFor("checkOut"))}>
            <label htmlFor="booking-check-out">Check-out date</label>
            <input id="booking-check-out" min={form.checkIn || undefined} onChange={(event) => update("checkOut", event.target.value)} type="date" value={form.checkOut} />
            {errorFor("checkOut") ? <small className="field-error">{errorFor("checkOut")}</small> : null}
          </div>
        </div>

        <div className="booking-rate-row">
          <div className="field-group" data-invalid={Boolean(errorFor("nightlyRate"))}>
            <label htmlFor="booking-nightly-rate">Nightly rate</label>
            <div className="money-input-wrap">
              <span aria-hidden="true">UGX</span>
              <input id="booking-nightly-rate" inputMode="numeric" min={0} onChange={(event) => update("nightlyRate", event.target.value)} step={1} type="number" value={form.nightlyRate} />
            </div>
            {errorFor("nightlyRate") ? <small className="field-error">{errorFor("nightlyRate")}</small> : null}
          </div>
          <output aria-label="Booking total" className="booking-total" htmlFor="booking-check-in booking-check-out booking-nightly-rate">
            <span>{calculation.nights === 1 ? "1 night" : `${calculation.nights} nights`}</span>
            <strong>{formatUgx(calculation.total)}</strong>
          </output>
        </div>

        <details className="booking-advanced">
          <summary>
            <span>Advanced booking details</span>
            <ChevronDown aria-hidden="true" size={16} />
          </summary>
          <div className="booking-advanced-body">
            <div className="booking-form-grid booking-time-grid">
              <div className="field-group">
                <label htmlFor="booking-check-in-time">Check-in time</label>
                <input id="booking-check-in-time" onChange={(event) => update("checkInTime", event.target.value)} type="time" value={form.checkInTime} />
              </div>
              <div className="field-group">
                <label htmlFor="booking-check-out-time">Check-out time</label>
                <input id="booking-check-out-time" onChange={(event) => update("checkOutTime", event.target.value)} type="time" value={form.checkOutTime} />
              </div>
            </div>
            <div className="field-group" data-invalid={Boolean(errorFor("adjustment"))}>
              <label htmlFor="booking-adjustment">Adjustment</label>
              <div className="money-input-wrap">
                <span aria-hidden="true">UGX</span>
                <input id="booking-adjustment" inputMode="numeric" onChange={(event) => update("adjustment", event.target.value)} step={1} type="number" value={form.adjustment} />
              </div>
              <small>Use a negative amount for a discount.</small>
              {errorFor("adjustment") ? <small className="field-error">{errorFor("adjustment")}</small> : null}
            </div>
            <label className="check-control">
              <input checked={form.referred} onChange={(event) => update("referred", event.target.checked)} type="checkbox" />
              Referral booking
            </label>
            {form.referred || Boolean(form.referrerName.trim()) ? (
              <div className="field-group" data-invalid={Boolean(errorFor("referrerName"))}>
                <label htmlFor="booking-referrer">Referrer</label>
                <input id="booking-referrer" onChange={(event) => update("referrerName", event.target.value)} value={form.referrerName} />
                {errorFor("referrerName") ? <small className="field-error">{errorFor("referrerName")}</small> : null}
              </div>
            ) : null}
            <div className="field-group" data-invalid={Boolean(errorFor("initialPayment"))}>
              <label htmlFor="booking-initial-payment">Initial payment</label>
              <div className="money-input-wrap">
                <span aria-hidden="true">UGX</span>
                <input id="booking-initial-payment" inputMode="numeric" min={0} onChange={(event) => update("initialPayment", event.target.value)} step={1} type="number" value={form.initialPayment} />
              </div>
              {errorFor("initialPayment") ? <small className="field-error">{errorFor("initialPayment")}</small> : null}
            </div>
            {Number(form.initialPayment) > 0 ? (
              <div className="payment-detail-grid">
                <div className="field-group">
                  <label htmlFor="booking-payment-date">Payment date</label>
                  <input id="booking-payment-date" onChange={(event) => update("paymentDate", event.target.value)} type="date" value={form.paymentDate} />
                </div>
                <div className="field-group">
                  <label htmlFor="booking-payment-method">Payment method</label>
                  <select id="booking-payment-method" onChange={(event) => update("paymentMethod", event.target.value as FormState["paymentMethod"])} value={form.paymentMethod}>
                    <option value="cash">Cash</option>
                    <option value="mobile_money">Mobile money</option>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="card">Card</option>
                  </select>
                </div>
                <div className="field-group payment-reference-field">
                  <label htmlFor="booking-payment-reference">Payment reference</label>
                  <input id="booking-payment-reference" onChange={(event) => update("paymentReference", event.target.value)} value={form.paymentReference} />
                </div>
              </div>
            ) : null}
            <div className="field-group">
              <label htmlFor="booking-notes">Notes</label>
              <textarea id="booking-notes" onChange={(event) => update("notes", event.target.value)} rows={3} value={form.notes} />
            </div>
          </div>
        </details>

        {!booking ? (
          <fieldset className="booking-state-control">
            <legend>Save as</legend>
            <label><input checked={form.status === "confirmed"} name="booking-status" onChange={() => update("status", "confirmed")} type="radio" /> Confirmed</label>
            <label><input checked={form.status === "draft"} name="booking-status" onChange={() => update("status", "draft")} type="radio" /> Draft</label>
          </fieldset>
        ) : null}

        <footer className="booking-editor-footer">
          {booking && onTransition ? (
            <div className="booking-transition-actions">
              {nextStatuses(booking.status).map((status) => (
                <button className="secondary-button compact-button" disabled={busy} key={status} onClick={() => void onTransition(status)} type="button">
                  {transitionLabels[status]}
                </button>
              ))}
            </div>
          ) : <span />}
          <div>
            <button className="secondary-button" onClick={onCancel} type="button">Cancel</button>
            <button className="primary-button" disabled={busy} type="submit">{busy ? "Saving…" : "Save booking"}</button>
          </div>
        </footer>
      </form>
    </aside>
  );
}
