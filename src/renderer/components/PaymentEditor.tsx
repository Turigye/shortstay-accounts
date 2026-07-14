import { X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import type { Booking } from "../../domain/bookings";
import type { PaymentDirection, PaymentMethod } from "../../domain/payments";
import type {
  PaymentAccount,
  PaymentMovement,
} from "../../main/db/repositories/payment-repository";

export type PaymentEditorMode = "receipt" | "refund" | "correction";

interface CommonPaymentValue {
  readonly amount: number;
  readonly paidAt: string;
  readonly method: PaymentMethod;
  readonly accountId: string;
  readonly reference: string | null;
  readonly note: string | null;
}

export type PaymentEditorValue =
  | (CommonPaymentValue & {
      readonly kind: "receipt";
      readonly confirmOverpayment: boolean;
    })
  | (CommonPaymentValue & {
      readonly kind: "refund";
      readonly additionalSettlement: boolean;
      readonly reason: string | null;
    })
  | (CommonPaymentValue & {
      readonly kind: "correction";
      readonly originalPaymentId: string;
      readonly direction: PaymentDirection;
      readonly reason: string;
      readonly confirmOverpayment: boolean;
      readonly additionalSettlement: boolean;
    });

interface PaymentEditorProps {
  readonly accounts: readonly PaymentAccount[];
  readonly booking: Booking;
  readonly mode: PaymentEditorMode;
  readonly originalMovement?: PaymentMovement | null;
  readonly onSubmit: (value: PaymentEditorValue) => void | Promise<void>;
  readonly onCancel: () => void;
}

function localDateTime(): string {
  const now = new Date();
  const local = new Date(now.valueOf() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIsoDateTime(value: string): string {
  return new Date(value).toISOString();
}

function formatUgx(value: number): string {
  return `UGX ${new Intl.NumberFormat("en-UG").format(value)}`;
}

function parseAmount(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

function methodForAccount(account: PaymentAccount | undefined): PaymentMethod {
  if (account?.type === "mobileMoney") return "mobileMoney";
  if (account?.type === "bank") return "bankTransfer";
  if (account?.type === "card") return "card";
  return "cash";
}

export function PaymentEditor({
  accounts,
  booking,
  mode,
  originalMovement,
  onSubmit,
  onCancel,
}: PaymentEditorProps) {
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(localDateTime);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [method, setMethod] = useState<PaymentMethod>(methodForAccount(accounts[0]));
  const [direction, setDirection] = useState<PaymentDirection>("refund");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [confirmOverpayment, setConfirmOverpayment] = useState(false);
  const [additionalSettlement, setAdditionalSettlement] = useState(false);
  const [showOverpayment, setShowOverpayment] = useState(false);
  const [showAdditionalSettlement, setShowAdditionalSettlement] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!accountId && accounts[0]) {
      setAccountId(accounts[0].id);
      setMethod(methodForAccount(accounts[0]));
    }
  }, [accountId, accounts]);

  const effectiveDirection = mode === "correction" ? direction : mode;
  const parsedAmount = parseAmount(amount);
  const proposedNet =
    effectiveDirection === "receipt" && parsedAmount !== null
      ? booking.netReceived + parsedAmount
      : booking.netReceived;
  const overpayment =
    effectiveDirection === "receipt" && parsedAmount !== null && Number.isSafeInteger(proposedNet)
      ? Math.max(0, proposedNet - booking.total)
      : 0;
  const overRefund =
    effectiveDirection === "refund" && parsedAmount !== null && parsedAmount > booking.netReceived;
  const title = mode === "correction" ? "Record correction" : mode === "refund" ? "Record refund" : "Record receipt";

  function clearError(field: string) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmissionError(null);
    const errors: Record<string, string> = {};
    const validAmount = parseAmount(amount);
    if (validAmount === null) errors.amount = "Enter a whole UGX amount greater than zero.";
    else if (effectiveDirection === "receipt" && !Number.isSafeInteger(booking.netReceived + validAmount)) {
      errors.amount = "This payment is outside the supported UGX range.";
    }
    if (!paidAt || Number.isNaN(new Date(paidAt).valueOf())) errors.paidAt = "Choose a valid payment date and time.";
    if (!accountId) errors.accountId = "Choose an active account.";
    if (mode === "correction" && !reason.trim()) errors.reason = "Explain this correction.";
    if (overpayment > 0 && !confirmOverpayment) {
      setShowOverpayment(true);
      errors.confirmOverpayment = "Confirm the overpayment before recording it.";
    }
    if (overRefund && !additionalSettlement) {
      setShowAdditionalSettlement(true);
      errors.additionalSettlement = "This refund is greater than the current net receipts.";
    }
    if (additionalSettlement && !reason.trim()) {
      errors.reason = "Explain the additional settlement.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || validAmount === null) return;

    const common = {
      amount: validAmount,
      paidAt: toIsoDateTime(paidAt),
      method,
      accountId,
      reference: reference.trim() || null,
      note: note.trim() || null,
    };
    const value: PaymentEditorValue =
      mode === "receipt"
        ? { ...common, kind: "receipt", confirmOverpayment }
        : mode === "refund"
          ? {
              ...common,
              kind: "refund",
              additionalSettlement,
              reason: reason.trim() || null,
            }
          : {
              ...common,
              kind: "correction",
              originalPaymentId: originalMovement?.id ?? "",
              direction,
              reason: reason.trim(),
              confirmOverpayment,
              additionalSettlement,
            };

    setBusy(true);
    try {
      await onSubmit(value);
    } catch {
      setSubmissionError("The payment could not be recorded. Review the details and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="payment-editor" aria-label={title}>
      <header className="payment-editor-header">
        <div>
          <h2>{title}</h2>
          <p>{booking.customerName} · {booking.unitName}</p>
        </div>
        <button aria-label="Close payment editor" className="icon-button" onClick={onCancel} type="button">
          <X aria-hidden="true" size={17} />
        </button>
      </header>
      <form className="payment-form" onSubmit={(event) => void handleSubmit(event)}>
        {submissionError ? <p className="form-alert">{submissionError}</p> : null}
        {mode === "correction" ? (
          <div className="field-group">
            <label htmlFor="payment-correction-direction">Correction effect</label>
            <select
              id="payment-correction-direction"
              onChange={(event) => setDirection(event.target.value as PaymentDirection)}
              value={direction}
            >
              <option value="refund">Reduce net receipts</option>
              <option value="receipt">Increase net receipts</option>
            </select>
          </div>
        ) : null}
        <div className="field-group" data-invalid={Boolean(fieldErrors.amount)}>
          <label htmlFor="payment-amount">Amount</label>
          <div className="money-input-wrap">
            <span aria-hidden="true">UGX</span>
            <input
              aria-invalid={Boolean(fieldErrors.amount)}
              id="payment-amount"
              inputMode="numeric"
              min={1}
              onChange={(event) => { setAmount(event.target.value); clearError("amount"); }}
              step={1}
              type="number"
              value={amount}
            />
          </div>
          {fieldErrors.amount ? <small className="field-error">{fieldErrors.amount}</small> : null}
        </div>
        <div className="field-group" data-invalid={Boolean(fieldErrors.paidAt)}>
          <label htmlFor="payment-paid-at">Payment date and time</label>
          <input
            id="payment-paid-at"
            onChange={(event) => { setPaidAt(event.target.value); clearError("paidAt"); }}
            type="datetime-local"
            value={paidAt}
          />
          {fieldErrors.paidAt ? <small className="field-error">{fieldErrors.paidAt}</small> : null}
        </div>
        <div className="payment-form-grid">
          <div className="field-group" data-invalid={Boolean(fieldErrors.accountId)}>
            <label htmlFor="payment-account">Account</label>
            <select
              id="payment-account"
              onChange={(event) => {
                const next = accounts.find(({ id }) => id === event.target.value);
                setAccountId(event.target.value);
                setMethod(methodForAccount(next));
                clearError("accountId");
              }}
              value={accountId}
            >
              <option value="">Choose account</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
            {fieldErrors.accountId ? <small className="field-error">{fieldErrors.accountId}</small> : null}
          </div>
          <div className="field-group">
            <label htmlFor="payment-method">Method</label>
            <select id="payment-method" onChange={(event) => setMethod(event.target.value as PaymentMethod)} value={method}>
              <option value="cash">Cash</option>
              <option value="mobileMoney">Mobile money</option>
              <option value="bankTransfer">Bank transfer</option>
              <option value="card">Card</option>
            </select>
          </div>
        </div>
        <div className="field-group">
          <label htmlFor="payment-reference">Reference</label>
          <input id="payment-reference" onChange={(event) => setReference(event.target.value)} value={reference} />
        </div>
        {(mode === "correction" || showAdditionalSettlement || additionalSettlement) ? (
          <div className="field-group" data-invalid={Boolean(fieldErrors.reason)}>
            <label htmlFor="payment-reason">Reason</label>
            <textarea
              id="payment-reason"
              onChange={(event) => { setReason(event.target.value); clearError("reason"); }}
              rows={3}
              value={reason}
            />
            {fieldErrors.reason ? <small className="field-error">{fieldErrors.reason}</small> : null}
          </div>
        ) : null}
        <div className="field-group">
          <label htmlFor="payment-note">Note</label>
          <textarea id="payment-note" onChange={(event) => setNote(event.target.value)} rows={2} value={note} />
        </div>
        {showOverpayment || overpayment > 0 ? (
          <div className="payment-warning">
            <strong>This will overpay this booking by {formatUgx(overpayment)}.</strong>
            <label className="check-control">
              <input
                checked={confirmOverpayment}
                onChange={(event) => { setConfirmOverpayment(event.target.checked); clearError("confirmOverpayment"); }}
                type="checkbox"
              />
              Confirm overpayment
            </label>
            {fieldErrors.confirmOverpayment ? <small className="field-error">{fieldErrors.confirmOverpayment}</small> : null}
          </div>
        ) : null}
        {showAdditionalSettlement || overRefund ? (
          <div className="payment-warning">
            <strong>This refund is greater than the current net receipts.</strong>
            <label className="check-control">
              <input
                checked={additionalSettlement}
                onChange={(event) => { setAdditionalSettlement(event.target.checked); clearError("additionalSettlement"); }}
                type="checkbox"
              />
              Record as additional settlement
            </label>
            {fieldErrors.additionalSettlement ? <small className="field-error">{fieldErrors.additionalSettlement}</small> : null}
          </div>
        ) : null}
        <footer className="payment-editor-footer">
          <button className="secondary-button" onClick={onCancel} type="button">Cancel</button>
          <button className="primary-button" disabled={busy || accounts.length === 0} type="submit">
            {busy ? "Recording…" : title}
          </button>
        </footer>
      </form>
    </aside>
  );
}
