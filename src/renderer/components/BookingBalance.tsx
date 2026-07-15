import { RotateCcw, Wrench } from "lucide-react";

import type { Booking } from "../../domain/bookings";
import type { PaymentMovement } from "../../main/db/repositories/payment-repository";

interface BookingBalanceProps {
  readonly booking: Booking;
  readonly movements: readonly PaymentMovement[];
  readonly onCorrect?: (movement: PaymentMovement) => void;
  readonly onReverse?: (movement: PaymentMovement) => void;
}

const methodLabels = {
  cash: "Cash",
  mobileMoney: "Mobile money",
  bankTransfer: "Bank transfer",
  card: "Card",
} as const;

const recordLabels = {
  receipt: "Receipt",
  refund: "Refund",
  reversal: "Reversal",
  correction: "Correction",
} as const;

function formatUgx(value: number): string {
  return `UGX ${new Intl.NumberFormat("en-UG").format(value)}`;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-UG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function BookingBalance({
  booking,
  movements,
  onCorrect,
  onReverse,
}: BookingBalanceProps) {
  const ordered = [...movements].sort(
    (left, right) =>
      left.paidAt.localeCompare(right.paidAt) ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id),
  );

  return (
    <section className="booking-balance" aria-label="Booking balance" data-tour="payment-balance">
      <dl className="balance-summary">
        {[
          ["Total", booking.total],
          ["Received", booking.received],
          ["Refunded", booking.refunded],
          ["Net received", booking.netReceived],
          ["Due", booking.due],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{formatUgx(value as number)}</dd>
          </div>
        ))}
      </dl>

      <div className="movement-heading">
        <h3>Movements</h3>
        <span>{ordered.length}</span>
      </div>
      {ordered.length === 0 ? (
        <p className="movement-empty">No receipts or refunds recorded.</p>
      ) : (
        <ol className="movement-list">
          {ordered.map((movement) => (
            <li key={movement.id}>
              <span className="movement-marker" data-direction={movement.direction} aria-hidden="true" />
              <div className="movement-copy">
                <div>
                  <strong>{recordLabels[movement.recordType]}</strong>
                  <span>{formatDateTime(movement.paidAt)}</span>
                </div>
                <p>
                  {methodLabels[movement.method]} · {movement.accountName}
                  {movement.reference ? ` · ${movement.reference}` : ""}
                </p>
                {movement.reason ? <small>{movement.reason}</small> : null}
              </div>
              <strong className="movement-amount" data-direction={movement.direction}>
                {movement.direction === "receipt" ? "+" : "-"}{formatUgx(movement.amount)}
              </strong>
              {onCorrect || onReverse ? (
                <div className="movement-actions">
                  {onCorrect && movement.recordType !== "reversal" ? (
                    <button
                      aria-label={`Correct ${recordLabels[movement.recordType].toLocaleLowerCase()} ${movement.reference ?? movement.id}`}
                      className="icon-button"
                      onClick={() => onCorrect(movement)}
                      title="Record correction"
                      type="button"
                    >
                      <Wrench aria-hidden="true" size={15} />
                    </button>
                  ) : null}
                  {onReverse && movement.recordType !== "reversal" ? (
                    <button
                      aria-label={`Reverse ${recordLabels[movement.recordType].toLocaleLowerCase()} ${movement.reference ?? movement.id}`}
                      className="icon-button"
                      onClick={() => onReverse(movement)}
                      title="Reverse movement"
                      type="button"
                    >
                      <RotateCcw aria-hidden="true" size={15} />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
