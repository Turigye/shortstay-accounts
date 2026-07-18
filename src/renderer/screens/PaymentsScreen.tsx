import { Archive, Pencil, Plus, Printer, RotateCw, WalletCards, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import type { Booking } from "../../domain/bookings";
import { summarizeBookingBalance } from "../../domain/payments";
import type {
  PaymentAccount,
  PaymentAccountType,
  PaymentMovement,
} from "../../main/db/repositories/payment-repository";
import { IPC_CHANNELS, type IpcFailure } from "../../shared/ipc";
import { BookingBalance } from "../components/BookingBalance";
import {
  PaymentEditor,
  type PaymentEditorMode,
  type PaymentEditorValue,
} from "../components/PaymentEditor";
import { useAppStore } from "../store/app-store";
import type { ReceiptDocument } from "../../main/receipt-service";
import { ReceiptDialog } from "../components/ReceiptDialog";

function firstError(failure: IpcFailure): string {
  return Object.values(failure.fieldErrors)[0]?.[0] ?? failure.message;
}

function localDateTime(): string {
  const now = new Date();
  const local = new Date(now.valueOf() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

type EditorState =
  | { mode: Exclude<PaymentEditorMode, "correction">; movement: null }
  | { mode: "correction"; movement: PaymentMovement };

export function PaymentsScreen() {
  const isEditor = useAppStore(({ user }) => user?.role === "editor");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [movements, setMovements] = useState<PaymentMovement[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [accountPanelOpen, setAccountPanelOpen] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<PaymentAccountType>("cash");
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [reversing, setReversing] = useState<PaymentMovement | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [reversalPaidAt, setReversalPaidAt] = useState(localDateTime);
  const [reversalBusy, setReversalBusy] = useState(false);
  const [reversalError, setReversalError] = useState<string | null>(null);
  const [confirmReversalOverpayment, setConfirmReversalOverpayment] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptDocument | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bookingResult, accountResult, movementResult] = await Promise.all([
        window.stayBooks.invoke(IPC_CHANNELS.BOOKINGS_LIST, {}),
        window.stayBooks.invoke(IPC_CHANNELS.ACCOUNTS_LIST, {}),
        window.stayBooks.invoke(IPC_CHANNELS.PAYMENTS_LIST, {}),
      ]);
      if (!bookingResult.ok) setError(firstError(bookingResult));
      else {
        setBookings(bookingResult.data);
        setSelectedBookingId((current) => current || bookingResult.data[0]?.id || "");
      }
      if (!accountResult.ok) setError(firstError(accountResult));
      else setAccounts(accountResult.data);
      if (!movementResult.ok) setError(firstError(movementResult));
      else setMovements(movementResult.data);
    } catch {
      setError("Payment records could not be loaded. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedBooking = bookings.find(({ id }) => id === selectedBookingId) ?? bookings[0] ?? null;
  const selectedMovements = useMemo(
    () => movements.filter(({ bookingId }) => bookingId === selectedBooking?.id),
    [movements, selectedBooking?.id],
  );
  const paymentHistory = useMemo(
    () => [...movements].sort((left, right) =>
      right.paidAt.localeCompare(left.paidAt) || right.createdAt.localeCompare(left.createdAt)),
    [movements],
  );

  function applyMovement(movement: PaymentMovement) {
    const nextMovements = [...movements, movement];
    setMovements(nextMovements);
    setBookings((current) =>
      current.map((booking) => {
        if (booking.id !== movement.bookingId) return booking;
        const summary = summarizeBookingBalance(
          booking.total,
          nextMovements
            .filter(({ bookingId }) => bookingId === booking.id)
            .map(({ direction, amount, recordType }) => ({ direction, amount, recordType })),
        );
        return {
          ...booking,
          ...summary,
          balance: summary.due,
        };
      }),
    );
  }

  async function openReceipt(paymentId: string) {
    setError(null);
    const result = await window.stayBooks.invoke(IPC_CHANNELS.RECEIPT_GET, { paymentId });
    if (!result.ok) return setError(firstError(result));
    setReceipt(result.data);
  }

  async function printReceipt(paymentId: string) {
    const result = await window.stayBooks.invoke(IPC_CHANNELS.RECEIPT_PRINT, { paymentId });
    if (!result.ok) setError(firstError(result));
  }

  async function saveReceiptPdf(paymentId: string) {
    const result = await window.stayBooks.invoke(IPC_CHANNELS.RECEIPT_EXPORT_PDF, { paymentId });
    if (!result.ok) setError(firstError(result));
  }

  async function recordPayment(value: PaymentEditorValue): Promise<void> {
    if (!selectedBooking) return;
    setError(null);
    let result;
    if (value.kind === "receipt") {
      const { kind: _kind, ...payload } = value;
      result = await window.stayBooks.invoke(IPC_CHANNELS.PAYMENT_RECEIPT, {
        ...payload,
        bookingId: selectedBooking.id,
      });
    } else if (value.kind === "refund") {
      const { kind: _kind, ...payload } = value;
      result = await window.stayBooks.invoke(IPC_CHANNELS.PAYMENT_REFUND, {
        ...payload,
        bookingId: selectedBooking.id,
      });
    } else {
      const { kind: _kind, ...payload } = value;
      result = await window.stayBooks.invoke(IPC_CHANNELS.PAYMENT_CORRECTION, {
        ...payload,
        bookingId: selectedBooking.id,
      });
    }
    if (!result.ok) {
      setError(firstError(result));
      throw new Error(result.message);
    }
    applyMovement(result.data);
    setEditor(null);
    if (result.data.recordType === "receipt") await openReceipt(result.data.id);
  }

  function editAccount(account: PaymentAccount) {
    setEditingAccountId(account.id);
    setAccountName(account.name);
    setAccountType(account.type);
    setAccountPanelOpen(true);
    setAccountError(null);
  }

  function openEditor(next: EditorState) {
    setAccountPanelOpen(false);
    setReversing(null);
    setEditor(next);
  }

  function openAccounts() {
    setEditor(null);
    setReversing(null);
    setAccountPanelOpen(true);
  }

  function resetAccountForm() {
    setEditingAccountId(null);
    setAccountName("");
    setAccountType("cash");
    setAccountError(null);
  }

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = accountName.trim();
    if (!name) {
      setAccountError("Enter an account name.");
      return;
    }
    setAccountBusy(true);
    setAccountError(null);
    try {
      const result = editingAccountId
        ? await window.stayBooks.invoke(IPC_CHANNELS.ACCOUNT_UPDATE, {
            id: editingAccountId,
            name,
            type: accountType,
          })
        : await window.stayBooks.invoke(IPC_CHANNELS.ACCOUNT_CREATE, { name, type: accountType });
      if (!result.ok) {
        setAccountError(firstError(result));
        return;
      }
      setAccounts((current) => {
        const withoutSaved = current.filter(({ id }) => id !== result.data.id);
        return [...withoutSaved, result.data].sort((left, right) => left.name.localeCompare(right.name));
      });
      resetAccountForm();
    } catch {
      setAccountError("The account could not be saved. Try again.");
    } finally {
      setAccountBusy(false);
    }
  }

  async function archiveAccount(account: PaymentAccount) {
    setAccountBusy(true);
    setAccountError(null);
    try {
      const result = await window.stayBooks.invoke(IPC_CHANNELS.ACCOUNT_ARCHIVE, { id: account.id });
      if (!result.ok) {
        setAccountError(firstError(result));
        return;
      }
      setAccounts((current) => current.filter(({ id }) => id !== account.id));
    } catch {
      setAccountError("The account could not be archived. Try again.");
    } finally {
      setAccountBusy(false);
    }
  }

  function beginReversal(movement: PaymentMovement) {
    setEditor(null);
    setAccountPanelOpen(false);
    setReversing(movement);
    setReversalReason("");
    setReversalPaidAt(localDateTime());
    setReversalError(null);
    setConfirmReversalOverpayment(false);
  }

  async function reverseMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reversing) return;
    if (!reversalReason.trim()) {
      setReversalError("Explain why this movement is being reversed.");
      return;
    }
    setReversalBusy(true);
    setReversalError(null);
    try {
      const result = await window.stayBooks.invoke(IPC_CHANNELS.PAYMENT_REVERSE, {
        paymentId: reversing.id,
        paidAt: new Date(reversalPaidAt).toISOString(),
        reason: reversalReason.trim(),
        confirmOverpayment: confirmReversalOverpayment || undefined,
      });
      if (!result.ok) {
        setReversalError(firstError(result));
        if (result.code === "OVERPAYMENT_CONFIRMATION_REQUIRED") {
          setConfirmReversalOverpayment(false);
        }
        return;
      }
      applyMovement(result.data);
      setReversing(null);
    } catch {
      setReversalError("The reversal could not be recorded. Try again.");
    } finally {
      setReversalBusy(false);
    }
  }

  return (
    <section className="payments-screen">
      <header className="payments-header">
        <div>
          <h1>Payments</h1>
          <p>Collections, refunds, account routing, and customer balances.</p>
        </div>
        <div className="page-actions">
          {!isEditor ? <button className="secondary-button compact-button" onClick={openAccounts} type="button">
            <WalletCards aria-hidden="true" size={16} /> Accounts
          </button> : null}
          <button
            className="primary-button compact-button"
            data-tour="payment-action"
            disabled={!selectedBooking || accounts.length === 0}
            onClick={() => openEditor({ mode: "receipt", movement: null })}
            type="button"
          >
            <Plus aria-hidden="true" size={16} /> Record payment
          </button>
        </div>
      </header>

      <div className="payments-toolbar">
        <div className="field-group compact-select" data-tour="payment-balance">
          <label htmlFor="payments-booking">Booking</label>
          <select id="payments-booking" onChange={(event) => setSelectedBookingId(event.target.value)} value={selectedBooking?.id ?? ""}>
            {bookings.map((booking) => (
              <option key={booking.id} value={booking.id}>{booking.customerName} · {booking.unitName}</option>
            ))}
          </select>
        </div>
        {selectedBooking && !isEditor ? (
          <button className="secondary-button compact-button" onClick={() => openEditor({ mode: "refund", movement: null })} type="button">
            Record refund
          </button>
        ) : null}
        <button aria-label="Refresh payments" className="icon-button" disabled={loading} onClick={() => void load()} title="Refresh" type="button">
          <RotateCw aria-hidden="true" size={16} />
        </button>
      </div>

      {error ? <p className="form-alert payments-alert">{error}</p> : null}
      <div className="payments-workspace" data-panel={Boolean(editor || accountPanelOpen || reversing)} data-payment-editor={Boolean(editor)}>
        <div className="payments-content" data-tour="payment-history">
          {loading ? (
            <div aria-label="Loading payments" className="bookings-skeleton"><span /><span /><span /></div>
          ) : selectedBooking ? (
            <>
              <section className="selected-payment-panel" aria-label="Selected booking payments">
                <div className="selected-booking-heading">
                  <div><strong>{selectedBooking.customerName}</strong><span>{selectedBooking.unitName}</span></div>
                  <span>{selectedBooking.checkIn} to {selectedBooking.checkOut}</span>
                </div>
                <BookingBalance
                  booking={selectedBooking}
                  movements={selectedMovements}
                  onCorrect={isEditor ? undefined : (movement) => openEditor({ mode: "correction", movement })}
                  onReverse={isEditor ? undefined : beginReversal}
                  onPrint={(movement) => void openReceipt(movement.id)}
                />
              </section>
              <section className="payment-history-panel" aria-label="All payment history">
                <header>
                  <div><h2>Payment history</h2><p>All recorded receipts, refunds, corrections, and reversals.</p></div>
                  <span>{paymentHistory.length} record{paymentHistory.length === 1 ? "" : "s"}</span>
                </header>
                <div className="table-scroll">
                  <table className="statement-table payment-history-table">
                    <thead><tr><th>Date</th><th>Customer</th><th>Unit</th><th>Type</th><th>Account</th><th>Reference</th><th>Amount</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
                    <tbody>
                      {paymentHistory.length ? paymentHistory.map((movement) => {
                        const booking = bookings.find(({ id }) => id === movement.bookingId);
                        return <tr key={movement.id}>
                          <td>{new Date(movement.paidAt).toLocaleDateString("en-UG")}</td>
                          <td><strong>{movement.customerName}</strong></td>
                          <td>{booking?.unitName ?? "—"}</td>
                          <td className="payment-history-type">{movement.recordType}</td>
                          <td>{movement.accountName}</td>
                          <td>{movement.reference ?? "—"}</td>
                          <td className="money-cell" data-direction={movement.direction}>{movement.direction === "receipt" ? "+" : "−"}{new Intl.NumberFormat("en-UG").format(movement.amount)}</td>
                          <td>{movement.recordType === "receipt" ? <button aria-label={`Print receipt ${movement.reference ?? movement.id}`} className="icon-button" onClick={() => void openReceipt(movement.id)} title="Print receipt" type="button"><Printer size={15} /></button> : null}</td>
                        </tr>;
                      }) : <tr><td className="table-empty" colSpan={8}>No payments recorded yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : (
            <div className="payments-empty"><WalletCards aria-hidden="true" size={24} /><h2>No bookings available</h2><p>No payment history to review. Create a booking before recording a payment.</p></div>
          )}
        </div>

        {editor && selectedBooking ? (
          <PaymentEditor
            accounts={accounts}
            booking={selectedBooking}
            mode={editor.mode}
            onCancel={() => setEditor(null)}
            onSubmit={recordPayment}
            originalMovement={editor.movement}
          />
        ) : null}

        {accountPanelOpen ? (
          <aside className="account-panel" aria-label="Payment accounts">
            <header><div><h2>Payment accounts</h2><p>Active local cash and settlement accounts</p></div><button aria-label="Close accounts" className="icon-button" onClick={() => { setAccountPanelOpen(false); resetAccountForm(); }} type="button"><X aria-hidden="true" size={17} /></button></header>
            <form className="account-form" onSubmit={(event) => void saveAccount(event)}>
              {accountError ? <p className="form-alert">{accountError}</p> : null}
              <div className="field-group"><label htmlFor="account-name">Account name</label><input id="account-name" onChange={(event) => setAccountName(event.target.value)} value={accountName} /></div>
              <div className="field-group"><label htmlFor="account-type">Type</label><select id="account-type" onChange={(event) => setAccountType(event.target.value as PaymentAccountType)} value={accountType}><option value="cash">Cash</option><option value="mobileMoney">Mobile money</option><option value="bank">Bank</option><option value="card">Card</option></select></div>
              <div className="account-form-actions">{editingAccountId ? <button className="secondary-button compact-button" onClick={resetAccountForm} type="button">Cancel edit</button> : null}<button className="primary-button compact-button" disabled={accountBusy} type="submit">{accountBusy ? "Saving…" : editingAccountId ? "Save account" : "Add account"}</button></div>
            </form>
            <ul className="account-list">
              {accounts.map((account) => <li key={account.id}><div><strong>{account.name}</strong><span>{account.type === "mobileMoney" ? "Mobile money" : account.type === "bank" ? "Bank" : account.type === "card" ? "Card" : "Cash"}</span></div><button aria-label={`Edit ${account.name}`} className="icon-button" onClick={() => editAccount(account)} title="Edit account" type="button"><Pencil aria-hidden="true" size={15} /></button><button aria-label={`Archive ${account.name}`} className="icon-button" disabled={accountBusy} onClick={() => void archiveAccount(account)} title="Archive account" type="button"><Archive aria-hidden="true" size={15} /></button></li>)}
            </ul>
          </aside>
        ) : null}

        {reversing ? (
          <aside className="reversal-panel" aria-label="Reverse payment movement">
            <header><div><h2>Reverse movement</h2><p>{reversing.reference ?? reversing.id}</p></div><button aria-label="Close reversal" className="icon-button" onClick={() => setReversing(null)} type="button"><X aria-hidden="true" size={17} /></button></header>
            <form onSubmit={(event) => void reverseMovement(event)}>
              {reversalError ? <p className="form-alert">{reversalError}</p> : null}
              <div className="field-group"><label htmlFor="reversal-paid-at">Reversal date and time</label><input id="reversal-paid-at" onChange={(event) => setReversalPaidAt(event.target.value)} type="datetime-local" value={reversalPaidAt} /></div>
              <div className="field-group"><label htmlFor="reversal-reason">Reason</label><textarea id="reversal-reason" onChange={(event) => setReversalReason(event.target.value)} rows={4} value={reversalReason} /></div>
              {reversalError?.toLocaleLowerCase().includes("overpay") ? <label className="check-control"><input checked={confirmReversalOverpayment} onChange={(event) => setConfirmReversalOverpayment(event.target.checked)} type="checkbox" />Confirm reversal overpayment</label> : null}
              <footer><button className="secondary-button" onClick={() => setReversing(null)} type="button">Cancel</button><button className="primary-button" disabled={reversalBusy} type="submit">{reversalBusy ? "Reversing…" : "Record reversal"}</button></footer>
            </form>
          </aside>
        ) : null}
      </div>
      {receipt ? (
        <ReceiptDialog
          onClose={() => setReceipt(null)}
          onPrint={printReceipt}
          onSavePdf={saveReceiptPdf}
          receipt={receipt}
        />
      ) : null}
    </section>
  );
}
