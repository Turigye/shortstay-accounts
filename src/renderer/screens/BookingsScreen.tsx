import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
  RotateCw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Booking, Customer } from "../../domain/bookings";
import type { BookingStatus, BusinessUnit } from "../../domain/types";
import type {
  PaymentAccount,
  PaymentMovement,
} from "../../main/db/repositories/payment-repository";
import { IPC_CHANNELS, type IpcFailure } from "../../shared/ipc";
import {
  BookingEditor,
  type BookingEditorValue,
  type NewCustomerValue,
} from "../components/BookingEditor";
import { StatusBadge, type StatusTone } from "../components/StatusBadge";
import { UnitSchedule } from "../components/UnitSchedule";

interface BookingsScreenProps {
  units: readonly BusinessUnit[];
  today?: string;
}

type View = "schedule" | "list";

interface EditorSeed {
  unitId: string;
  checkIn: string;
}

const DAY_IN_MILLISECONDS = 86_400_000;

function todayString(): string {
  const today = new Date();
  const local = new Date(today.valueOf() - today.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00.000Z`).valueOf() + days * DAY_IN_MILLISECONDS)
    .toISOString()
    .slice(0, 10);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-UG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function formatMoney(value: number): string {
  return `UGX ${new Intl.NumberFormat("en-UG").format(value)}`;
}

const statusLabels: Readonly<Record<BookingStatus, string>> = {
  draft: "Draft",
  confirmed: "Confirmed",
  checkedIn: "Checked in",
  completed: "Completed",
  cancelled: "Cancelled",
};

const statusTones: Readonly<Record<BookingStatus, StatusTone>> = {
  draft: "neutral",
  confirmed: "info",
  checkedIn: "warning",
  completed: "success",
  cancelled: "danger",
};

function firstError(failure: IpcFailure): string {
  return Object.values(failure.fieldErrors)[0]?.[0] ?? failure.message;
}

export function BookingsScreen({ units, today = todayString() }: BookingsScreenProps) {
  const [view, setView] = useState<View>("schedule");
  const [startDate, setStartDate] = useState(today);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [movements, setMovements] = useState<PaymentMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, readonly string[]>>>({});
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [editorSeed, setEditorSeed] = useState<EditorSeed | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "">("");
  const [unitFilter, setUnitFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<"" | "unpaid" | "outstanding" | "paid">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minimumTotal, setMinimumTotal] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [bookingResult, customerResult] = await Promise.all([
      window.stayBooks.invoke(IPC_CHANNELS.BOOKINGS_LIST, {}),
      window.stayBooks.invoke(IPC_CHANNELS.CUSTOMERS_LIST, {}),
    ]);
    if (!bookingResult.ok) setError(firstError(bookingResult));
    else setBookings(bookingResult.data);
    if (!customerResult.ok) setError(firstError(customerResult));
    else setCustomers(customerResult.data);
    try {
      const [accountResult, movementResult] = await Promise.all([
        window.stayBooks.invoke(IPC_CHANNELS.ACCOUNTS_LIST, {}),
        window.stayBooks.invoke(IPC_CHANNELS.PAYMENTS_LIST, {}),
      ]);
      if (!accountResult.ok) setError(firstError(accountResult));
      else setAccounts(accountResult.data);
      if (!movementResult.ok) setError(firstError(movementResult));
      else setMovements(movementResult.data);
    } catch {
      setError("Payment accounts and history could not be loaded. Refresh to try again.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredBookings = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const minimum = minimumTotal ? Number(minimumTotal) : null;
    return bookings.filter((booking) => {
      if (
        normalizedQuery &&
        !`${booking.customerName} ${booking.customerPhone} ${booking.unitName}`
          .toLocaleLowerCase()
          .includes(normalizedQuery)
      ) return false;
      if (statusFilter && booking.status !== statusFilter) return false;
      if (unitFilter && booking.unitId !== unitFilter) return false;
      if (customerFilter && booking.customerId !== customerFilter) return false;
      if (dateFrom && booking.checkOut <= dateFrom) return false;
      if (dateTo && booking.checkIn >= dateTo) return false;
      if (minimum !== null && Number.isFinite(minimum) && booking.total < minimum) return false;
      if (balanceFilter === "unpaid" && booking.paymentState !== "unpaid") return false;
      if (balanceFilter === "outstanding" && booking.balance <= 0) return false;
      if (balanceFilter === "paid" && booking.balance > 0) return false;
      return true;
    });
  }, [
    balanceFilter,
    bookings,
    customerFilter,
    dateFrom,
    dateTo,
    minimumTotal,
    query,
    statusFilter,
    unitFilter,
  ]);

  function closeEditor() {
    setEditorOpen(false);
    setSelectedBooking(null);
    setEditorSeed(null);
    setError(null);
    setFieldErrors({});
  }

  function openNew(seed: EditorSeed | null = null) {
    setSelectedBooking(null);
    setEditorSeed(seed);
    setEditorOpen(true);
    setError(null);
    setFieldErrors({});
  }

  function openExisting(booking: Booking) {
    setSelectedBooking(booking);
    setEditorSeed(null);
    setEditorOpen(true);
    setError(null);
    setFieldErrors({});
  }

  async function createCustomer(input: NewCustomerValue): Promise<Customer> {
    const result = await window.stayBooks.invoke(IPC_CHANNELS.CUSTOMER_CREATE, input);
    if (!result.ok) {
      setError(firstError(result));
      setFieldErrors(result.fieldErrors);
      throw new Error(result.message);
    }
    setCustomers((current) => [...current, result.data].sort((a, b) => a.name.localeCompare(b.name)));
    return result.data;
  }

  async function saveBooking(input: BookingEditorValue) {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const result = selectedBooking
        ? await window.stayBooks.invoke(IPC_CHANNELS.BOOKING_UPDATE, (() => {
            const { initialPayment: _initialPayment, ...bookingInput } = input;
            return { id: selectedBooking.id, ...bookingInput };
          })())
        : await window.stayBooks.invoke(IPC_CHANNELS.BOOKING_CREATE, input);
      if (!result.ok) {
        setError(firstError(result));
        setFieldErrors(result.fieldErrors);
        return;
      }
      setBookings((current) => {
        const withoutSaved = current.filter(({ id }) => id !== result.data.id);
        return [...withoutSaved, result.data].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
      });
      closeEditor();
    } finally {
      setBusy(false);
    }
  }

  async function transitionBooking(status: BookingStatus) {
    if (!selectedBooking) return;
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const result = await window.stayBooks.invoke(IPC_CHANNELS.BOOKING_TRANSITION, {
        id: selectedBooking.id,
        status,
      });
      if (!result.ok) {
        setError(firstError(result));
        setFieldErrors(result.fieldErrors);
        return;
      }
      setSelectedBooking(result.data);
      setBookings((current) => current.map((item) => (item.id === result.data.id ? result.data : item)));
    } catch {
      setError("The booking status could not be updated. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bookings-screen">
      <header className="bookings-header">
        <div>
          <h1>Bookings</h1>
          <p>Manual stays, customer details, and live unit availability.</p>
        </div>
        <button className="primary-button compact-button" onClick={() => openNew()} type="button">
          <Plus aria-hidden="true" size={16} /> New booking
        </button>
      </header>

      <div className="bookings-toolbar">
        <div aria-label="Booking views" className="view-tabs" role="tablist">
          <button aria-selected={view === "schedule"} onClick={() => setView("schedule")} role="tab" type="button">
            <CalendarDays aria-hidden="true" size={16} /> Schedule
          </button>
          <button aria-selected={view === "list"} onClick={() => setView("list")} role="tab" type="button">
            <List aria-hidden="true" size={16} /> List
          </button>
        </div>
        {view === "schedule" ? (
          <div className="schedule-date-controls">
            <button aria-label="Previous 14 days" className="icon-button" onClick={() => setStartDate(addDays(startDate, -14))} type="button">
              <ChevronLeft aria-hidden="true" size={17} />
            </button>
            <button className="secondary-button compact-button" onClick={() => setStartDate(today)} type="button">Today</button>
            <button aria-label="Next 14 days" className="icon-button" onClick={() => setStartDate(addDays(startDate, 14))} type="button">
              <ChevronRight aria-hidden="true" size={17} />
            </button>
            <span>{formatDate(startDate)} – {formatDate(addDays(startDate, 13))}</span>
          </div>
        ) : null}
        <button aria-label="Refresh bookings" className="icon-button bookings-refresh" disabled={loading} onClick={() => void load()} type="button">
          <RotateCw aria-hidden="true" size={15} />
        </button>
      </div>

      <div className="bookings-body" data-editor={editorOpen}>
        <div className="bookings-content">
          {loading ? (
            <div aria-label="Loading bookings" className="bookings-skeleton">
              <span /><span /><span />
            </div>
          ) : view === "schedule" ? (
            <UnitSchedule
              bookings={bookings}
              onCreateBooking={(unitId, checkIn) => openNew({ unitId, checkIn })}
              onSelectBooking={openExisting}
              startDate={startDate}
              units={units}
            />
          ) : (
            <>
              <div className="booking-filters" aria-label="Booking filters">
                <div className="field-group filter-search">
                  <label htmlFor="booking-filter-search">Customer or unit</label>
                  <input id="booking-filter-search" onChange={(event) => setQuery(event.target.value)} placeholder="Search" value={query} />
                </div>
                <div className="field-group">
                  <label htmlFor="booking-filter-status">Status</label>
                  <select id="booking-filter-status" onChange={(event) => setStatusFilter(event.target.value as BookingStatus | "")} value={statusFilter}>
                    <option value="">All</option>
                    {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div className="field-group">
                  <label htmlFor="booking-filter-unit">Unit</label>
                  <select id="booking-filter-unit" onChange={(event) => setUnitFilter(event.target.value)} value={unitFilter}>
                    <option value="">All</option>
                    {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                  </select>
                </div>
                <div className="field-group">
                  <label htmlFor="booking-filter-customer">Customer</label>
                  <select id="booking-filter-customer" onChange={(event) => setCustomerFilter(event.target.value)} value={customerFilter}>
                    <option value="">All</option>
                    {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                  </select>
                </div>
                <div className="field-group">
                  <label htmlFor="booking-filter-balance">Balance</label>
                  <select id="booking-filter-balance" onChange={(event) => setBalanceFilter(event.target.value as typeof balanceFilter)} value={balanceFilter}>
                    <option value="">All</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="outstanding">Outstanding</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div className="field-group"><label htmlFor="booking-filter-from">From</label><input id="booking-filter-from" onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} /></div>
                <div className="field-group"><label htmlFor="booking-filter-to">To</label><input id="booking-filter-to" onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} /></div>
                <div className="field-group"><label htmlFor="booking-filter-total">Minimum total</label><input id="booking-filter-total" min={0} onChange={(event) => setMinimumTotal(event.target.value)} step={1} type="number" value={minimumTotal} /></div>
              </div>
              <div className="bookings-table-wrap">
                <table>
                  <caption className="visually-hidden">Bookings</caption>
                  <thead><tr><th scope="col">Status</th><th scope="col">Unit</th><th scope="col">Customer</th><th scope="col">Stay</th><th data-align="end" scope="col">Total</th><th data-align="end" scope="col">Balance</th></tr></thead>
                  <tbody>
                    {filteredBookings.length > 0 ? filteredBookings.map((booking) => (
                      <tr key={booking.id}>
                        <td><StatusBadge tone={statusTones[booking.status]}>{statusLabels[booking.status]}</StatusBadge></td>
                        <td>{booking.unitName}</td>
                        <td><button aria-label={`Open booking for ${booking.customerName}`} className="table-row-link" onClick={() => openExisting(booking)} type="button"><strong>{booking.customerName}</strong><span>{booking.customerPhone}</span></button></td>
                        <td><strong>{formatDate(booking.checkIn)}</strong><span>{booking.nights} {booking.nights === 1 ? "night" : "nights"} · to {formatDate(booking.checkOut)}</span></td>
                        <td data-align="end">{formatMoney(booking.total)}</td>
                        <td data-align="end"><strong>{formatMoney(booking.balance)}</strong><span>{statusLabels[booking.status] === "Cancelled" ? "Released" : booking.paymentState === "unpaid" ? "Unpaid" : booking.paymentState}</span></td>
                      </tr>
                    )) : <tr><td className="table-empty" colSpan={6}>No bookings match these filters.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {editorOpen ? (
          <BookingEditor
            accounts={accounts}
            booking={selectedBooking}
            busy={busy}
            customers={customers}
            error={error}
            fieldErrors={fieldErrors}
            initialCheckIn={editorSeed?.checkIn}
            initialUnitId={editorSeed?.unitId}
            onCancel={closeEditor}
            onCreateCustomer={createCustomer}
            onSave={saveBooking}
            onTransition={transitionBooking}
            movements={movements.filter(({ bookingId }) => bookingId === selectedBooking?.id)}
            units={units}
          />
        ) : null}
      </div>
    </section>
  );
}
