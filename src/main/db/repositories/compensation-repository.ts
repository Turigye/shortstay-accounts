import type Database from "better-sqlite3-multiple-ciphers";

import {
  DEFAULT_STAFF_RATES,
  STAFF_ROLE_ORDER,
  calculateCompensation,
  calculateReferral,
} from "../../../domain/compensation";
import {
  allocateEligibleCollection,
  calculateNetCollectedBookingRevenue,
} from "../../../domain/revenue-allocation";
import { ugx } from "../../../domain/money";
import { splitStayByMonth } from "../../../domain/periods";
import type { MonthKey, RoleKey, Ugx } from "../../../domain/types";
import type { PaymentMethod } from "../../../domain/payments";

export interface StaffStatementLine {
  readonly role: RoleKey;
  readonly base: Ugx;
  readonly rate: number;
  readonly earned: Ugx;
  readonly adjustment: Ugx;
  readonly paid: Ugx;
  readonly due: Ugx;
  readonly worked: boolean;
  readonly statusReason: string | null;
}

export interface ReferralStatementLine {
  readonly bookingId: string;
  readonly customerName: string;
  readonly referrerName: string;
  readonly base: Ugx;
  readonly rate: number;
  readonly earned: Ugx;
  readonly adjustment: Ugx;
  readonly paid: Ugx;
  readonly due: Ugx;
}

export interface CompensationTrace {
  readonly bookingId: string;
  readonly customerName: string;
  readonly unitName: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly earnedRevenue: Ugx;
  readonly eligibleBase: Ugx;
}

export interface MonthlyCompensationReport {
  readonly month: MonthKey;
  readonly ncbr: Ugx;
  readonly staff: StaffStatementLine[];
  readonly referrals: ReferralStatementLine[];
  readonly traces: CompensationTrace[];
}

export interface CompensationRepository {
  getMonthlyReport(month: MonthKey): MonthlyCompensationReport;
  recordStaffSettlement(input: StaffSettlementInput): MonthlyCompensationReport;
  setStaffWorked(input: StaffWorkedInput): MonthlyCompensationReport;
}

export interface StaffSettlementInput {
  readonly month: string;
  readonly role: RoleKey;
  readonly direction: "payment" | "return";
  readonly amount: number;
  readonly paidAt: string;
  readonly accountId: string;
  readonly method: PaymentMethod;
  readonly reference?: string | null;
  readonly notes?: string | null;
}

export interface StaffWorkedInput {
  readonly month: string;
  readonly role: RoleKey;
  readonly worked: boolean;
  readonly reason: string;
}

interface BookingCalculationRow {
  id: string;
  check_in: string;
  check_out: string;
  total_amount: number;
  status: string;
  referrer_id: string | null;
  referral_rate_basis_points: number | null;
  referrer_rate_basis_points: number | null;
  business_rate_basis_points: number;
  received: number;
  refunded: number;
  cleaning_fee: number;
  guest_tax: number;
  refundable_deposit: number;
}

interface StaffRateRow {
  id: string;
  role: RoleKey;
  rate_basis_points: number;
}

const MONTH_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const METHOD_TO_DATABASE: Readonly<Record<PaymentMethod, string>> = {
  cash: "cash", mobileMoney: "mobile_money", bankTransfer: "bank_transfer", card: "card",
};

function requireMonth(month: string): MonthKey {
  if (!MONTH_PATTERN.test(month)) throw new Error("Month must use YYYY-MM.");
  return month as MonthKey;
}

function ratesForMonth(
  database: Database.Database,
  businessId: string,
  month: MonthKey,
): StaffRateRow[] {
  return STAFF_ROLE_ORDER.map((role) => {
    const row = database
      .prepare<[string, RoleKey, string], StaffRateRow>(`
        SELECT id, role, rate_basis_points
        FROM staff_roles
        WHERE business_id = ? AND role = ? AND effective_from <= ? AND archived_at IS NULL
        ORDER BY effective_from DESC, created_at DESC, id DESC
        LIMIT 1
      `)
      .get(businessId, role, `${month}-31`);
    if (row) return row;
    const earliest = database
      .prepare<[string, RoleKey], StaffRateRow>(`
        SELECT id, role, rate_basis_points
        FROM staff_roles
        WHERE business_id = ? AND role = ? AND archived_at IS NULL
        ORDER BY effective_from, created_at, id
        LIMIT 1
      `)
      .get(businessId, role);
    if (earliest) return earliest;
    throw new Error(`No staff rate is configured for ${role}.`);
  });
}

export function refreshBookingCompensation(
  database: Database.Database,
  businessId: string,
  bookingId: string,
): void {
  const booking = database
    .prepare<[string, string], BookingCalculationRow>(`
      SELECT
        b.id, b.check_in, b.check_out, b.total_amount, b.status,
        b.referrer_id, b.referral_rate_basis_points,
        r.default_rate_basis_points AS referrer_rate_basis_points,
        businesses.referral_rate_basis_points AS business_rate_basis_points,
        COALESCE(SUM(CASE WHEN p.direction = 'receipt' THEN p.amount ELSE 0 END), 0) AS received,
        COALESCE(SUM(CASE WHEN p.direction = 'refund' THEN p.amount ELSE 0 END), 0) AS refunded,
        b.cleaning_fee, b.guest_tax, b.refundable_deposit
      FROM bookings b
      JOIN businesses ON businesses.id = b.business_id
      LEFT JOIN referrers r ON r.id = b.referrer_id
      LEFT JOIN payments p ON p.booking_id = b.id AND p.business_id = b.business_id
      WHERE b.id = ? AND b.business_id = ? AND b.archived_at IS NULL
      GROUP BY b.id
    `)
    .get(bookingId, businessId);
  if (!booking) return;

  const eligibleCollected = calculateNetCollectedBookingRevenue({
    accommodationTotal: ugx(booking.total_amount),
    collected: ugx(booking.received),
    cleaningFeesCollected: ugx(booking.cleaning_fee),
    guestTaxesCollected: ugx(booking.guest_tax),
    refundableDepositsCollected: ugx(booking.refundable_deposit),
    accommodationRefunds: ugx(booking.refunded),
  });
  const allocations = allocateEligibleCollection({
    checkIn: booking.check_in,
    checkOut: booking.check_out,
    accommodationTotal: ugx(booking.total_amount),
    eligibleCollected,
    completed: booking.status === "completed",
  });
  const occupiedNights = new Map(
    splitStayByMonth(booking.check_in, booking.check_out).map(({ month, nights }) => [month, nights]),
  );

  const months = allocations.map(({ month }) => month);
  if (months.length > 0) {
    const placeholders = months.map(() => "?").join(", ");
    database.prepare(`DELETE FROM booking_months WHERE booking_id = ? AND month NOT IN (${placeholders})`)
      .run(booking.id, ...months);
    database.prepare(`DELETE FROM staff_earnings WHERE booking_id = ? AND month NOT IN (${placeholders})`)
      .run(booking.id, ...months);
    database.prepare(`DELETE FROM referral_earnings WHERE booking_id = ? AND month NOT IN (${placeholders})`)
      .run(booking.id, ...months);
  }

  for (const allocation of allocations) {
    database.prepare(`
      INSERT INTO booking_months (booking_id, month, occupied_nights, earned_revenue, payable_base)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (booking_id, month) DO UPDATE SET
        earned_revenue = excluded.earned_revenue,
        payable_base = excluded.payable_base
    `).run(
      booking.id,
      allocation.month,
      occupiedNights.get(allocation.month) ?? 1,
      allocation.earnedRevenue,
      allocation.payableBase,
    );

    const staffRates = ratesForMonth(database, businessId, allocation.month);
    const rates = Object.fromEntries(
      staffRates.map(({ role, rate_basis_points }) => [role, rate_basis_points / 100]),
    ) as Record<RoleKey, number>;
    for (const earning of calculateCompensation(allocation.payableBase, rates, allocation.month)) {
      const rate = staffRates.find(({ role }) => role === earning.role);
      if (!rate) continue;
      database.prepare(`
        INSERT INTO staff_earnings (
          business_id, booking_id, staff_role_id, month, eligible_base,
          rate_basis_points, earned_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (booking_id, staff_role_id, month) DO UPDATE SET
          eligible_base = excluded.eligible_base,
          rate_basis_points = excluded.rate_basis_points,
          earned_amount = excluded.earned_amount
      `).run(
        businessId,
        booking.id,
        rate.id,
        allocation.month,
        allocation.payableBase,
        Math.round(earning.rate * 100),
        earning.amount,
      );
      database.prepare(`
        UPDATE staff_earnings
        SET adjustment = -earned_amount
        WHERE booking_id = ? AND staff_role_id = ? AND month = ?
          AND EXISTS (
            SELECT 1 FROM staff_month_status status
            WHERE status.business_id = staff_earnings.business_id
              AND status.staff_role_id = staff_earnings.staff_role_id
              AND status.month = staff_earnings.month
              AND status.worked = 0
          )
      `).run(booking.id, rate.id, allocation.month);
    }

    if (booking.referrer_id) {
      const rateBasisPoints = booking.referral_rate_basis_points
        ?? booking.referrer_rate_basis_points
        ?? booking.business_rate_basis_points;
      const earned = calculateReferral(allocation.payableBase, rateBasisPoints / 100);
      database.prepare(`
        INSERT INTO referral_earnings (
          business_id, booking_id, referrer_id, month, eligible_base,
          rate_basis_points, earned_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (booking_id, referrer_id, month) DO UPDATE SET
          eligible_base = excluded.eligible_base,
          rate_basis_points = excluded.rate_basis_points,
          earned_amount = excluded.earned_amount
      `).run(
        businessId,
        booking.id,
        booking.referrer_id,
        allocation.month,
        allocation.payableBase,
        rateBasisPoints,
        earned,
      );
    }
  }
}

export function createCompensationRepository(
  database: Database.Database,
  businessId: string,
): CompensationRepository {
  const repository: CompensationRepository = {
    getMonthlyReport(monthInput: MonthKey) {
      const month = requireMonth(monthInput);
      const monthStart = `${month}-01`;
      const nextMonthDate = new Date(`${monthStart}T00:00:00.000Z`);
      nextMonthDate.setUTCMonth(nextMonthDate.getUTCMonth() + 1);
      const nextMonthStart = nextMonthDate.toISOString().slice(0, 10);
      const bookingIds = database.prepare<[string, string, string], { id: string }>(`
        SELECT id FROM bookings
        WHERE business_id = ? AND archived_at IS NULL
          AND check_in < ? AND check_out > ?
      `).all(businessId, nextMonthStart, monthStart);
      database.transaction(() => {
        for (const { id } of bookingIds) refreshBookingCompensation(database, businessId, id);
      }).immediate();
      const configuredRates = ratesForMonth(database, businessId, month);
      const staffRows = database.prepare<[string, string], {
        role: RoleKey;
        eligible_base: number;
        rate_basis_points: number;
        earned_amount: number;
        adjustment: number;
        paid_amount: number;
      }>(`
        SELECT sr.role,
          COALESCE(SUM(se.eligible_base), 0) AS eligible_base,
          sr.rate_basis_points,
          COALESCE(SUM(se.earned_amount), 0) AS earned_amount,
          COALESCE(SUM(se.adjustment), 0) AS adjustment,
          COALESCE(SUM(se.paid_amount), 0) AS paid_amount
        FROM staff_earnings se
        JOIN staff_roles sr ON sr.id = se.staff_role_id
        WHERE se.business_id = ? AND se.month = ?
        GROUP BY sr.role, sr.rate_basis_points
      `).all(businessId, month);
      const staff = configuredRates.map(({ role, rate_basis_points }) => {
        const row = staffRows.find((candidate) => candidate.role === role);
        const earned = row?.earned_amount ?? 0;
        const adjustment = row?.adjustment ?? 0;
        const paid = row?.paid_amount ?? 0;
        const status = database.prepare<[string,string,string],{worked:number;reason:string}>(
          `SELECT status.worked,status.reason FROM staff_month_status status
           JOIN staff_roles role ON role.id=status.staff_role_id
           WHERE status.business_id=? AND status.month=? AND role.role=?`,
        ).get(businessId,month,role);
        return {
          role,
          base: ugx(row?.eligible_base ?? 0),
          rate: (row?.rate_basis_points ?? rate_basis_points) / 100,
          earned: ugx(earned),
          adjustment: ugx(adjustment),
          paid: ugx(paid),
          due: ugx(Math.max(0, earned + adjustment - paid)),
          worked: status?.worked !== 0,
          statusReason: status?.reason ?? null,
        };
      });
      const referralRows = database.prepare<[string, string], {
        booking_id: string;
        customer_name: string;
        referrer_name: string;
        eligible_base: number;
        rate_basis_points: number;
        earned_amount: number;
        adjustment: number;
        paid_amount: number;
      }>(`
        SELECT re.booking_id, c.name AS customer_name, r.name AS referrer_name,
          re.eligible_base, re.rate_basis_points, re.earned_amount,
          re.adjustment, re.paid_amount
        FROM referral_earnings re
        JOIN bookings b ON b.id = re.booking_id
        JOIN customers c ON c.id = b.customer_id
        JOIN referrers r ON r.id = re.referrer_id
        WHERE re.business_id = ? AND re.month = ?
        ORDER BY lower(r.name), b.check_in, re.booking_id
      `).all(businessId, month);
      const traces = database.prepare<[string, string], {
        booking_id: string;
        customer_name: string;
        unit_name: string;
        check_in: string;
        check_out: string;
        earned_revenue: number;
        payable_base: number;
      }>(`
        SELECT bm.booking_id, c.name AS customer_name, u.name AS unit_name,
          b.check_in, b.check_out, bm.earned_revenue, bm.payable_base
        FROM booking_months bm
        JOIN bookings b ON b.id = bm.booking_id
        JOIN customers c ON c.id = b.customer_id
        JOIN units u ON u.id = b.unit_id
        WHERE b.business_id = ? AND bm.month = ? AND bm.payable_base > 0
        ORDER BY b.check_in, lower(c.name), bm.booking_id
      `).all(businessId, month);

      return {
        month,
        ncbr: ugx(traces.reduce((sum, row) => sum + row.payable_base, 0)),
        staff,
        referrals: referralRows.map((row) => ({
          bookingId: row.booking_id,
          customerName: row.customer_name,
          referrerName: row.referrer_name,
          base: ugx(row.eligible_base),
          rate: row.rate_basis_points / 100,
          earned: ugx(row.earned_amount),
          adjustment: ugx(row.adjustment),
          paid: ugx(row.paid_amount),
          due: ugx(Math.max(0, row.earned_amount + row.adjustment - row.paid_amount)),
        })),
        traces: traces.map((row) => ({
          bookingId: row.booking_id,
          customerName: row.customer_name,
          unitName: row.unit_name,
          checkIn: row.check_in,
          checkOut: row.check_out,
          earnedRevenue: ugx(row.earned_revenue),
          eligibleBase: ugx(row.payable_base),
        })),
      };
    },
    recordStaffSettlement(input) {
      const month=requireMonth(input.month);
      if(!DATE_PATTERN.test(input.paidAt)||Number.isNaN(Date.parse(`${input.paidAt}T00:00:00.000Z`)))throw new Error("Choose a valid payment date.");
      if(!Number.isSafeInteger(input.amount)||input.amount<=0)throw new Error("Enter a whole positive UGX amount.");
      if(!["payment","return"].includes(input.direction))throw new Error("Choose payment or returned funds.");
      const method=METHOD_TO_DATABASE[input.method];if(!method)throw new Error("Choose a valid payment method.");
      if(database.prepare<[string,string],{status:string}>("SELECT status FROM period_closes WHERE business_id=? AND month=?").get(businessId,month)?.status==="closed")throw new Error(`${month} is closed. Reopen it before making changes.`);
      if(!database.prepare("SELECT 1 FROM accounts WHERE id=? AND business_id=? AND archived_at IS NULL").get(input.accountId,businessId))throw new Error("Choose an active payment account.");
      const roleRow=ratesForMonth(database,businessId,month).find(({role})=>role===input.role);if(!roleRow)throw new Error("Choose a valid staff role.");
      const report=repository.getMonthlyReport(month);
      const line=report.staff.find(({role})=>role===input.role);if(!line)throw new Error("Staff role not found.");
      const limit=input.direction==="payment"?line.due:line.paid;
      if(input.amount>limit)throw new Error(input.direction==="payment"?"Payment exceeds the amount due.":"Return exceeds the amount paid.");
      const rows=database.prepare<[string,string,string],{id:string;earned_amount:number;adjustment:number;paid_amount:number}>(`
        SELECT se.id,se.earned_amount,se.adjustment,se.paid_amount FROM staff_earnings se
        JOIN staff_roles sr ON sr.id=se.staff_role_id
        WHERE se.business_id=? AND se.month=? AND sr.role=?
        ORDER BY se.created_at,se.id
      `).all(businessId,month,input.role);
      database.transaction(()=>{
        let remaining=input.amount;
        const ordered=input.direction==="payment"?rows:[...rows].reverse();
        for(const row of ordered){
          if(remaining<=0)break;
          const capacity=input.direction==="payment"?Math.max(0,row.earned_amount+row.adjustment-row.paid_amount):row.paid_amount;
          const allocated=Math.min(remaining,capacity);
          if(allocated)database.prepare("UPDATE staff_earnings SET paid_amount=paid_amount+? WHERE id=?").run(input.direction==="payment"?allocated:-allocated,row.id);
          remaining-=allocated;
        }
        database.prepare(`
          INSERT INTO staff_payments (business_id,staff_role_id,month,account_id,direction,amount,paid_at,method,reference,notes)
          VALUES (?,?,?,?,?,?,?,?,?,?)
        `).run(businessId,roleRow.id,month,input.accountId,input.direction,input.amount,input.paidAt,method,input.reference?.trim()||null,input.notes?.trim()||null);
      }).immediate();
      return repository.getMonthlyReport(month);
    },
    setStaffWorked(input) {
      const month=requireMonth(input.month),reason=input.reason.trim();
      if(!reason)throw new Error("Explain the attendance change.");
      if(database.prepare<[string,string],{status:string}>("SELECT status FROM period_closes WHERE business_id=? AND month=?").get(businessId,month)?.status==="closed")throw new Error(`${month} is closed. Reopen it before making changes.`);
      const roleRow=ratesForMonth(database,businessId,month).find(({role})=>role===input.role);if(!roleRow)throw new Error("Choose a valid staff role.");
      const line=repository.getMonthlyReport(month).staff.find(({role})=>role===input.role);if(!line)throw new Error("Staff role not found.");
      if(!input.worked&&line.paid>0)throw new Error("Record all returned funds before marking this role as not worked.");
      database.transaction(()=>{
        database.prepare(`
          INSERT INTO staff_month_status (business_id,staff_role_id,month,worked,reason)
          VALUES (?,?,?,?,?)
          ON CONFLICT (business_id,staff_role_id,month) DO UPDATE SET worked=excluded.worked,reason=excluded.reason
        `).run(businessId,roleRow.id,month,input.worked?1:0,reason);
        database.prepare("UPDATE staff_earnings SET adjustment=CASE WHEN ?=1 THEN 0 ELSE -earned_amount END WHERE business_id=? AND staff_role_id=? AND month=?")
          .run(input.worked?1:0,businessId,roleRow.id,month);
      }).immediate();
      return repository.getMonthlyReport(month);
    },
  };
  return Object.freeze(repository);
}

export const FALLBACK_STAFF_RATES = DEFAULT_STAFF_RATES;
