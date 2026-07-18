import type Database from "better-sqlite3-multiple-ciphers";

export interface ReceiptDocument {
  readonly paymentId: string;
  readonly reference: string;
  readonly businessName: string;
  readonly paidAt: string;
  readonly guestName: string;
  readonly guestPhone: string;
  readonly unitName: string;
  readonly occupancyMode: "whole_unit" | "one_room";
  readonly checkIn: string;
  readonly checkOut: string;
  readonly amount: number;
  readonly amountWords: string;
  readonly method: "Cash" | "Mobile money" | "Bank transfer" | "Card";
  readonly accountName: string;
  readonly externalReference: string | null;
  readonly bookingTotal: number;
  readonly receivedAfter: number;
  readonly remainingBalance: number;
  readonly receivedBy: string;
  readonly receivedByUserId: string | null;
  readonly reversed: boolean;
}

interface ReceiptRow {
  payment_id: string;
  business_name: string;
  paid_at: string;
  guest_name: string;
  guest_phone: string | null;
  unit_name: string;
  occupancy_mode: "whole_unit" | "one_room";
  check_in: string;
  check_out: string;
  amount: number;
  method: "cash" | "mobile_money" | "bank_transfer" | "card";
  account_name: string;
  external_reference: string | null;
  booking_total: number;
  received_after: number;
  received_by: string | null;
  received_by_user_id: string | null;
  reversed: number;
}

const SMALL = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  "sixteen", "seventeen", "eighteen", "nineteen",
] as const;
const TENS = [
  "", "", "twenty", "thirty", "forty", "fifty",
  "sixty", "seventy", "eighty", "ninety",
] as const;

function underThousand(value: number): string {
  const parts: string[] = [];
  if (value >= 100) {
    parts.push(`${SMALL[Math.floor(value / 100)]} hundred`);
    value %= 100;
  }
  if (value >= 20) {
    parts.push(TENS[Math.floor(value / 10)]);
    if (value % 10) parts.push(SMALL[value % 10]);
  } else if (value > 0) {
    parts.push(SMALL[value]);
  }
  return parts.join(" ");
}

export function ugxInWords(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("Receipt amount must be a non-negative whole UGX value.");
  }
  if (value === 0) return "Zero Uganda shillings only";
  const scales = ["", "thousand", "million", "billion", "trillion"] as const;
  const groups: string[] = [];
  let remaining = value;
  let scale = 0;
  while (remaining > 0) {
    const group = remaining % 1000;
    if (group) {
      const suffix = scales[scale];
      groups.unshift(`${underThousand(group)}${suffix ? ` ${suffix}` : ""}`);
    }
    remaining = Math.floor(remaining / 1000);
    scale += 1;
  }
  const words = groups.join(" ");
  return `${words[0].toUpperCase()}${words.slice(1)} Uganda shillings only`;
}

const METHOD_LABELS: Record<ReceiptRow["method"], ReceiptDocument["method"]> = {
  cash: "Cash",
  mobile_money: "Mobile money",
  bank_transfer: "Bank transfer",
  card: "Card",
};

export function getReceiptDocument(
  database: Database.Database,
  businessId: string,
  paymentId: string,
): ReceiptDocument {
  const row = database.prepare<[string, string], ReceiptRow>(`
    SELECT
      p.id AS payment_id,
      business.name AS business_name,
      p.paid_at,
      customer.name AS guest_name,
      customer.phone AS guest_phone,
      unit.name AS unit_name,
      booking.occupancy_mode,
      booking.check_in,
      booking.check_out,
      p.amount,
      p.method,
      account.name AS account_name,
      p.reference AS external_reference,
      booking.total_amount AS booking_total,
      (
        SELECT COALESCE(SUM(CASE movement.direction
          WHEN 'receipt' THEN movement.amount ELSE -movement.amount END), 0)
        FROM payments movement
        WHERE movement.business_id = p.business_id
          AND movement.booking_id = p.booking_id
          AND (
            movement.paid_at < p.paid_at
            OR (movement.paid_at = p.paid_at AND movement.created_at < p.created_at)
            OR (
              movement.paid_at = p.paid_at
              AND movement.created_at = p.created_at
              AND movement.id <= p.id
            )
          )
      ) AS received_after,
      user.name AS received_by,
      p.created_by_user_id AS received_by_user_id,
      EXISTS (
        SELECT 1 FROM payments reversal
        WHERE reversal.business_id = p.business_id
          AND reversal.reversal_of_id = p.id
      ) AS reversed
    FROM payments p
    JOIN businesses business ON business.id = p.business_id
    JOIN bookings booking ON booking.id = p.booking_id
    JOIN customers customer ON customer.id = booking.customer_id
    JOIN units unit ON unit.id = booking.unit_id
    JOIN accounts account ON account.id = p.account_id
    LEFT JOIN users user ON user.id = p.created_by_user_id
    WHERE p.id = ? AND p.business_id = ? AND p.record_type = 'receipt'
  `).get(paymentId, businessId);
  if (!row) throw new Error("Receipt payment was not found.");

  const date = row.paid_at.slice(0, 10).replaceAll("-", "");
  return Object.freeze({
    paymentId: row.payment_id,
    reference: `RCT-${date}-${row.payment_id.slice(0, 6).toUpperCase()}`,
    businessName: row.business_name,
    paidAt: row.paid_at,
    guestName: row.guest_name,
    guestPhone: row.guest_phone ?? "",
    unitName: row.unit_name,
    occupancyMode: row.occupancy_mode,
    checkIn: row.check_in,
    checkOut: row.check_out,
    amount: row.amount,
    amountWords: ugxInWords(row.amount),
    method: METHOD_LABELS[row.method],
    accountName: row.account_name,
    externalReference: row.external_reference,
    bookingTotal: row.booking_total,
    receivedAfter: row.received_after,
    remainingBalance: Math.max(0, row.booking_total - row.received_after),
    receivedBy: row.received_by ?? "Recorded before user profiles",
    receivedByUserId: row.received_by_user_id,
    reversed: row.reversed === 1,
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value: number): string {
  return `UGX ${new Intl.NumberFormat("en-UG").format(value)}`;
}

export function renderReceiptHtml(receipt: ReceiptDocument): string {
  const row = (label: string, value: string) =>
    `<div class="row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(receipt.reference)}</title>
<style>
  *{box-sizing:border-box}body{margin:0;background:#fff;color:#17211b;font:14px/1.45 Arial,sans-serif}
  .receipt-sheet{width:100%;max-width:760px;margin:0 auto;padding:36px}
  header{display:flex;justify-content:space-between;gap:24px;padding-bottom:20px;border-bottom:2px solid #273a2f}
  h1{margin:0;font-size:24px}header p{margin:4px 0 0;color:#5a655f}.reference{text-align:right}
  .void{margin:18px 0;padding:10px;border:2px solid #9b2c2c;color:#9b2c2c;font-weight:700;text-align:center}
  .amount{margin:24px 0;padding:18px 0;border-block:1px solid #cdd4d0}.amount strong{display:block;font-size:28px}
  .row{display:grid;grid-template-columns:180px 1fr;gap:20px;padding:9px 0;border-bottom:1px solid #e4e8e6}.row span{color:#65706a}
  footer{margin-top:28px;padding-top:16px;border-top:1px solid #cdd4d0;color:#65706a;font-size:12px}
  @page{size:A4;margin:14mm}@media print{body{print-color-adjust:exact}.receipt-sheet{padding:0}}
</style></head><body><main class="receipt-sheet">
  <header><div><h1>${escapeHtml(receipt.businessName)}</h1><p>Payment Receipt</p></div><div class="reference"><strong>${escapeHtml(receipt.reference)}</strong><p>${escapeHtml(new Date(receipt.paidAt).toLocaleString("en-UG"))}</p></div></header>
  ${receipt.reversed ? '<div class="void">REVERSED</div>' : ""}
  <section class="amount"><span>Amount received</span><strong>${money(receipt.amount)}</strong><small>${escapeHtml(receipt.amountWords)}</small></section>
  ${row("Guest", receipt.guestName)}
  ${row("Telephone", receipt.guestPhone || "-")}
  ${row("Accommodation", `${receipt.unitName} · ${receipt.occupancyMode === "one_room" ? "One room" : "Whole unit"}`)}
  ${row("Stay", `${receipt.checkIn} to ${receipt.checkOut}`)}
  ${row("Payment method", `${receipt.method} · ${receipt.accountName}`)}
  ${receipt.externalReference ? row("Payment reference", receipt.externalReference) : ""}
  ${row("Booking total", money(receipt.bookingTotal))}
  ${row("Received to date", money(receipt.receivedAfter))}
  ${row("Remaining balance", money(receipt.remainingBalance))}
  ${row("Received by", receipt.receivedBy)}
  <footer>This receipt confirms a payment recorded by ${escapeHtml(receipt.businessName)}. It is not represented as a URA tax invoice.</footer>
</main></body></html>`;
}
