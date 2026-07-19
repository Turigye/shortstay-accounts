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
  const businessInitials =
    receipt.businessName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "SA";
  const paidAt = new Intl.DateTimeFormat("en-UG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(receipt.paidAt));
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(receipt.reference)}</title>
<style>
  :root{color-scheme:light}*{box-sizing:border-box}
  body{margin:0;background:#f3f5f2;color:#17211b;font:14px/1.5 Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased}
  .receipt-sheet{width:100%;max-width:760px;margin:0 auto;padding:36px}
  .receipt-document{overflow:hidden;border:1px solid #cfd6d1;border-radius:10px;background:#fff;box-shadow:0 12px 35px rgba(23,33,27,.08)}
  .receipt-header{display:flex;justify-content:space-between;gap:28px;padding:28px 30px 24px;border-top:7px solid #4f5700;border-bottom:1px solid #dce2de}
  .brand{display:flex;align-items:center;gap:13px}.brand-mark{display:grid;width:42px;height:42px;place-items:center;border-radius:7px;background:#4f5700;color:#fff;font-size:16px;font-weight:800}
  h1{margin:0;font-size:23px;line-height:1.2}.brand p,.reference p{margin:4px 0 0;color:#65706a;font-size:12px}
  .reference{text-align:right}.reference span{display:block;color:#65706a;font-size:11px;font-weight:700;text-transform:uppercase}.reference strong{display:block;margin-top:3px;font-size:15px;font-variant-numeric:tabular-nums}
  .void{margin:20px 30px 0;padding:10px;border:2px solid #9b2c2c;border-radius:6px;color:#9b2c2c;font-weight:800;text-align:center;letter-spacing:.08em}
  .receipt-body{display:grid;gap:20px;padding:26px 30px 30px}
  .receipt-card{border:1px solid #dce2de;border-radius:8px;background:#fff}
  .receipt-total{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:20px;padding:20px 22px;background:#f4f5ea;border-color:#d8dac0}
  .receipt-total span,.section-title{color:#65706a;font-size:11px;font-weight:800;text-transform:uppercase}
  .receipt-total strong{display:block;margin-top:3px;color:#303700;font-size:28px;line-height:1.15;font-variant-numeric:tabular-nums}
  .receipt-total small{display:block;max-width:380px;margin-top:6px;color:#65706a}
  .paid-state{padding:6px 10px;border-radius:999px;background:#dff2e2;color:#21652d;font-size:11px;font-weight:800;text-transform:uppercase}
  .receipt-details{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  .detail-group{overflow:hidden;border:1px solid #dce2de;border-radius:8px}.section-title{display:block;padding:12px 16px;background:#f7f8f6;border-bottom:1px solid #dce2de}
  .row{display:grid;grid-template-columns:125px minmax(0,1fr);gap:16px;padding:10px 16px;border-bottom:1px solid #e8ece9}.row:last-child{border-bottom:0}.row span{color:#65706a}.row strong{min-width:0;text-align:right;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
  footer{padding:16px 30px 20px;border-top:1px solid #dce2de;background:#fafbfa;color:#65706a;font-size:11px}
  @page{size:A4;margin:14mm}
  @media print{body{background:#fff;print-color-adjust:exact;-webkit-print-color-adjust:exact}.receipt-sheet{max-width:none;padding:0}.receipt-document{box-shadow:none}}
  @media(max-width:620px){.receipt-sheet{padding:16px}.receipt-header{padding:22px}.receipt-body{padding:22px}.receipt-details{grid-template-columns:1fr}.receipt-total{grid-template-columns:1fr}.reference{max-width:180px}}
</style></head><body><main class="receipt-sheet">
  <article class="receipt-document">
    <header class="receipt-header"><div class="brand"><span class="brand-mark">${escapeHtml(businessInitials)}</span><div><h1>${escapeHtml(receipt.businessName)}</h1><p>Official payment receipt</p></div></div><div class="reference"><span>Receipt number</span><strong>${escapeHtml(receipt.reference)}</strong><p>${escapeHtml(paidAt)}</p></div></header>
    ${receipt.reversed ? '<div class="void">Reversed receipt</div>' : ""}
    <div class="receipt-body">
      <section class="receipt-card receipt-total"><div><span>Amount received</span><strong>${money(receipt.amount)}</strong><small>${escapeHtml(receipt.amountWords)}</small></div><b class="paid-state">${receipt.reversed ? "Reversed" : "Payment recorded"}</b></section>
      <section class="receipt-details">
        <div class="detail-group"><span class="section-title">Guest and stay</span>
          ${row("Guest", receipt.guestName)}
          ${row("Telephone", receipt.guestPhone || "-")}
          ${row("Accommodation", `${receipt.unitName} · ${receipt.occupancyMode === "one_room" ? "One room" : "Two bedrooms"}`)}
          ${row("Stay", `${receipt.checkIn} to ${receipt.checkOut}`)}
        </div>
        <div class="detail-group"><span class="section-title">Payment summary</span>
          ${row("Method", `${receipt.method} · ${receipt.accountName}`)}
          ${receipt.externalReference ? row("Reference", receipt.externalReference) : ""}
          ${row("Booking total", money(receipt.bookingTotal))}
          ${row("Received to date", money(receipt.receivedAfter))}
          ${row("Balance", money(receipt.remainingBalance))}
          ${row("Received by", receipt.receivedBy)}
        </div>
      </section>
    </div>
    <footer>This receipt confirms a payment recorded by ${escapeHtml(receipt.businessName)}. It is not represented as a URA tax invoice.</footer>
  </article>
</main></body></html>`;
}
