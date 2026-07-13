import type Database from "better-sqlite3-multiple-ciphers";

import type {
  BusinessSettings,
  BusinessUnit,
  RateSetting,
  RoleKey,
  StaffRateSetting,
  Ugx,
} from "../../../domain/types";
import { createAuditRepository } from "./audit-repository";

export const APPROVED_STAFF_RATES: Readonly<Record<RoleKey, number>> = {
  operations: 5,
  salesMarketing: 5,
  finance: 10,
  itLegal: 2,
  security: 5,
  ceo: 10,
};

export const APPROVED_REFERRAL_RATE = 10;
export const APPROVED_TAX_PROVISION_PER_UNIT = 600_000;

const ROLE_KEYS = Object.keys(APPROVED_STAFF_RATES) as RoleKey[];

export interface CreateBusinessInput {
  name: string;
  password: string;
  unitNames?: readonly [string, string];
}

export interface ManageUnitsInput {
  units: readonly { readonly id?: string; readonly name: string }[];
}

export type SetRateInput =
  | {
      kind: "staff";
      role: RoleKey;
      value: number;
      effectiveFrom: string;
      reason?: string;
    }
  | {
      kind: "referral" | "taxProvision";
      value: number;
      effectiveFrom: string;
      reason?: string;
    };

export interface BusinessRepository {
  create(input: CreateBusinessInput): BusinessSettings;
  getSettings(): BusinessSettings | null;
  manageUnits(input: ManageUnitsInput): BusinessSettings;
  setRate(input: SetRateInput): BusinessSettings;
}

export class BusinessRepositoryError extends Error {
  constructor(
    readonly code: "VALIDATION_ERROR" | "CONFLICT",
    message: string,
    readonly fieldErrors: Readonly<Record<string, readonly string[]>> = {},
  ) {
    super(message);
    this.name = "BusinessRepositoryError";
  }
}

interface RepositoryOptions {
  now?: () => Date;
}

interface BusinessRow {
  id: string;
  name: string;
  currency: "UGX";
}

interface UnitRow {
  id: string;
  name: string;
  status: BusinessUnit["status"];
}

interface StaffRateRow {
  id: string;
  role: RoleKey;
  rate_basis_points: number;
  effective_from: string;
  reason: string | null;
}

interface ReferralRateRow {
  id: string;
  rate_basis_points: number;
  effective_from: string;
  reason: string | null;
}

interface TaxRateRow {
  id: string;
  amount_per_unit: number;
  effective_from: string;
  reason: string | null;
}

function requiredText(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new TypeError(`${label} is required`);
  return trimmed;
}

function validatePassword(password: string): void {
  if (password.length < 10) {
    throw new TypeError("Local password must be at least 10 characters");
  }
}

function validateUnitNames(unitNames: readonly string[]): [string, string] {
  if (unitNames.length !== 2) {
    throw new TypeError("Exactly two initial units are required");
  }
  const names = unitNames.map((name) => requiredText(name, "Unit name")) as [
    string,
    string,
  ];
  if (names[0].localeCompare(names[1], undefined, { sensitivity: "accent" }) === 0) {
    throw new TypeError("Unit names must be different");
  }
  return names;
}

function validateManagedUnits(
  units: ManageUnitsInput["units"],
): { id?: string; name: string }[] {
  if (units.length === 0) {
    throw new BusinessRepositoryError(
      "VALIDATION_ERROR",
      "At least one active unit is required.",
      { units: ["Keep or add at least one active unit."] },
    );
  }
  const normalized = units.map(({ id, name }) => ({
    ...(id ? { id } : {}),
    name: requiredText(name, "Unit name"),
  }));
  const names = normalized.map(({ name }) => name.toLocaleLowerCase());
  if (new Set(names).size !== names.length) {
    throw new BusinessRepositoryError(
      "CONFLICT",
      "Unit names must be different.",
      { units: ["Give every active unit a different name."] },
    );
  }
  const ids = normalized.flatMap(({ id }) => (id ? [id] : []));
  if (new Set(ids).size !== ids.length) {
    throw new BusinessRepositoryError(
      "CONFLICT",
      "A unit was included more than once.",
      { units: ["Each existing unit can appear only once."] },
    );
  }
  return normalized;
}

function validateDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError("Effective date must use YYYY-MM-DD");
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new TypeError("Effective date is invalid");
  }
  return value;
}

function toBasisPoints(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new TypeError("Percentage rate must be between 0 and 100");
  }
  return Math.round(value * 100);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function createBusinessRepository(
  database: Database.Database,
  options: RepositoryOptions = {},
): BusinessRepository {
  const now = options.now ?? (() => new Date());
  const audit = createAuditRepository(database);
  const synchronizeCurrentValues = database.prepare<{
    asOf: string;
    businessId: string;
  }>(`
    UPDATE businesses
    SET
      referral_rate_basis_points = COALESCE((
        SELECT rate_basis_points
        FROM referral_rates
        WHERE business_id = @businessId
          AND effective_from <= @asOf
          AND archived_at IS NULL
        ORDER BY effective_from DESC, created_at DESC, id DESC
        LIMIT 1
      ), referral_rate_basis_points),
      tax_provision_per_unit = COALESCE((
        SELECT amount_per_unit
        FROM tax_provision_rates
        WHERE business_id = @businessId
          AND effective_from <= @asOf
          AND archived_at IS NULL
        ORDER BY effective_from DESC, created_at DESC, id DESC
        LIMIT 1
      ), tax_provision_per_unit)
    WHERE id = @businessId
  `);

  function businessRow(): BusinessRow | undefined {
    return database
      .prepare<[], BusinessRow>(
        "SELECT id, name, currency FROM businesses WHERE archived_at IS NULL ORDER BY created_at LIMIT 1",
      )
      .get();
  }

  function getSettings(): BusinessSettings | null {
    const business = businessRow();
    if (!business) return null;

    const units = database
      .prepare<[string], UnitRow>(
        "SELECT id, name, status FROM units WHERE business_id = ? AND status = 'active' AND archived_at IS NULL ORDER BY sort_order, created_at, id",
      )
      .all(business.id);
    const staffRows = database
      .prepare<[string], StaffRateRow>(`
        SELECT id, role, rate_basis_points, effective_from, reason
        FROM staff_roles
        WHERE business_id = ? AND archived_at IS NULL
        ORDER BY effective_from, created_at, id
      `)
      .all(business.id);
    const referralRows = database
      .prepare<[string], ReferralRateRow>(`
        SELECT id, rate_basis_points, effective_from, reason
        FROM referral_rates
        WHERE business_id = ? AND archived_at IS NULL
        ORDER BY effective_from, created_at, id
      `)
      .all(business.id);
    const taxRows = database
      .prepare<[string], TaxRateRow>(`
        SELECT id, amount_per_unit, effective_from, reason
        FROM tax_provision_rates
        WHERE business_id = ? AND archived_at IS NULL
        ORDER BY effective_from, created_at, id
      `)
      .all(business.id);
    const closedMonths = database
      .prepare<[string], { month: string }>(
        "SELECT month FROM period_closes WHERE business_id = ? AND status = 'closed' ORDER BY month",
      )
      .all(business.id)
      .map(({ month }) => month);
    const asOf = formatDate(now());
    const staffRates = { ...APPROVED_STAFF_RATES };
    for (const row of staffRows) {
      if (row.effective_from <= asOf) {
        staffRates[row.role] = row.rate_basis_points / 100;
      }
    }
    const activeReferral = referralRows.filter((row) => row.effective_from <= asOf).at(-1);
    const activeTax = taxRows.filter((row) => row.effective_from <= asOf).at(-1);
    const staffHistory: StaffRateSetting[] = staffRows.map((row) => ({
      id: row.id,
      role: row.role,
      value: row.rate_basis_points / 100,
      effectiveFrom: row.effective_from,
      reason: row.reason,
    }));
    const referralHistory: RateSetting[] = referralRows.map((row) => ({
      id: row.id,
      value: row.rate_basis_points / 100,
      effectiveFrom: row.effective_from,
      reason: row.reason,
    }));
    const taxHistory: RateSetting[] = taxRows.map((row) => ({
      id: row.id,
      value: row.amount_per_unit,
      effectiveFrom: row.effective_from,
      reason: row.reason,
    }));

    return {
      businessId: business.id,
      name: business.name,
      currency: business.currency,
      units,
      unitIds: units.map(({ id }) => id),
      staffRates,
      referralRate: activeReferral
        ? activeReferral.rate_basis_points / 100
        : APPROVED_REFERRAL_RATE,
      taxProvisionPerUnit: (activeTax?.amount_per_unit ??
        APPROVED_TAX_PROVISION_PER_UNIT) as Ugx,
      closedMonths,
      rateHistory: {
        staff: staffHistory,
        referral: referralHistory,
        taxProvision: taxHistory,
      },
    };
  }

  function requireBusiness(): BusinessSettings {
    const settings = getSettings();
    if (!settings) throw new Error("Business setup has not been completed");
    return settings;
  }

  function requiresReason(businessId: string, effectiveFrom: string): boolean {
    const month = effectiveFrom.slice(0, 7);
    const currentMonth = formatDate(now()).slice(0, 7);
    const closed = database
      .prepare<[string, string], { status: string }>(
        "SELECT status FROM period_closes WHERE business_id = ? AND month = ?",
      )
      .get(businessId, month);
    return month < currentMonth || closed?.status === "closed";
  }

  return Object.freeze({
    create(input: CreateBusinessInput): BusinessSettings {
      if (businessRow()) throw new Error("A business already exists in this file");
      const name = requiredText(input.name, "Business name");
      validatePassword(input.password);
      const unitNames = validateUnitNames(input.unitNames ?? ["Unit 1", "Unit 2"]);
      const effectiveFrom = formatDate(now());

      database.transaction(() => {
        const inserted = database
          .prepare<[string], { id: string }>("INSERT INTO businesses (name) VALUES (?) RETURNING id")
          .get(name);
        if (!inserted) throw new Error("Business could not be created");

        const insertUnit = database.prepare(
          "INSERT INTO units (business_id, name, sort_order) VALUES (?, ?, ?)",
        );
        unitNames.forEach((unitName, index) =>
          insertUnit.run(inserted.id, unitName, index),
        );

        const insertStaffRate = database.prepare(
          "INSERT INTO staff_roles (business_id, role, rate_basis_points, effective_from) VALUES (?, ?, ?, ?)",
        );
        for (const role of ROLE_KEYS) {
          insertStaffRate.run(
            inserted.id,
            role,
            toBasisPoints(APPROVED_STAFF_RATES[role]),
            effectiveFrom,
          );
        }
        database
          .prepare(
            "INSERT INTO referral_rates (business_id, rate_basis_points, effective_from) VALUES (?, ?, ?)",
          )
          .run(inserted.id, toBasisPoints(APPROVED_REFERRAL_RATE), effectiveFrom);
        database
          .prepare(
            "INSERT INTO tax_provision_rates (business_id, amount_per_unit, effective_from) VALUES (?, ?, ?)",
          )
          .run(inserted.id, APPROVED_TAX_PROVISION_PER_UNIT, effectiveFrom);
        audit.append({
          entityType: "business",
          entityId: inserted.id,
          action: "create",
          after: { name, unitNames, effectiveFrom },
        });
      }).immediate();

      return requireBusiness();
    },

    getSettings,

    manageUnits(input: ManageUnitsInput): BusinessSettings {
      const business = requireBusiness();
      const units = validateManagedUnits(input.units);
      const activeIds = new Set(business.unitIds);
      const unknownId = units.find(({ id }) => id && !activeIds.has(id));
      if (unknownId?.id) {
        throw new BusinessRepositoryError(
          "CONFLICT",
          "The unit list is out of date.",
          { units: ["Reload settings before saving unit changes."] },
        );
      }

      try {
        database.transaction(() => {
          const suppliedIds = new Set(
            units.flatMap(({ id }) => (id ? [id] : [])),
          );
          const archive = database.prepare(`
            UPDATE units
            SET status = 'inactive', archived_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ? AND business_id = ? AND status = 'active' AND archived_at IS NULL
          `);
          for (const id of business.unitIds) {
            if (!suppliedIds.has(id)) archive.run(id, business.businessId);
          }

          const temporaryRename = database.prepare(
            "UPDATE units SET name = ? WHERE id = ? AND business_id = ?",
          );
          for (const { id } of units) {
            if (id) temporaryRename.run(`__updating_${id}`, id, business.businessId);
          }

          const update = database.prepare(`
            UPDATE units
            SET name = ?, sort_order = ?, status = 'active', archived_at = NULL
            WHERE id = ? AND business_id = ?
          `);
          const insert = database.prepare(
            "INSERT INTO units (business_id, name, sort_order) VALUES (?, ?, ?)",
          );
          units.forEach((unit, index) => {
            if (unit.id) {
              update.run(unit.name, index, unit.id, business.businessId);
            } else {
              insert.run(business.businessId, unit.name, index);
            }
          });
          audit.append({
            entityType: "business",
            entityId: business.businessId,
            action: "update",
            before: { units: business.units },
            after: { units },
          });
        }).immediate();
      } catch (error) {
        if (error instanceof BusinessRepositoryError) throw error;
        if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
          throw new BusinessRepositoryError(
            "CONFLICT",
            "A unit with that name already exists.",
            { units: ["Use a different name for each unit."] },
          );
        }
        throw error;
      }

      return requireBusiness();
    },

    setRate(input: SetRateInput): BusinessSettings {
      const business = requireBusiness();
      const effectiveFrom = validateDate(input.effectiveFrom);
      const reason = input.reason?.trim() || null;
      if (requiresReason(business.businessId, effectiveFrom) && !reason) {
        throw new BusinessRepositoryError(
          "VALIDATION_ERROR",
          "A reason is required for historical or closed-period changes.",
          {
            effectiveFrom: [
              "Enter a reason for this historical or closed period.",
            ],
          },
        );
      }

      database.transaction(() => {
        let entityId: string;
        let before: Record<string, unknown> | null = null;
        let after: Record<string, unknown>;
        if (input.kind === "staff") {
          if (!ROLE_KEYS.includes(input.role)) throw new TypeError("Staff role is invalid");
          const existing = database
            .prepare<[string, RoleKey, string], StaffRateRow>(`
              SELECT id, role, rate_basis_points, effective_from, reason
              FROM staff_roles
              WHERE business_id = ? AND role = ? AND effective_from = ? AND archived_at IS NULL
            `)
            .get(business.businessId, input.role, effectiveFrom);
          const basisPoints = toBasisPoints(input.value);
          if (existing) {
            entityId = existing.id;
            before = {
              kind: "staff",
              role: input.role,
              value: existing.rate_basis_points / 100,
              effectiveFrom: existing.effective_from,
              reason: existing.reason,
            };
            database
              .prepare(
                "UPDATE staff_roles SET rate_basis_points = ?, reason = ? WHERE id = ?",
              )
              .run(basisPoints, reason, existing.id);
          } else {
            const inserted = database
              .prepare<[string, RoleKey, number, string, string | null], { id: string }>(
                "INSERT INTO staff_roles (business_id, role, rate_basis_points, effective_from, reason) VALUES (?, ?, ?, ?, ?) RETURNING id",
              )
              .get(business.businessId, input.role, basisPoints, effectiveFrom, reason);
            if (!inserted) throw new Error("Staff rate could not be saved");
            entityId = inserted.id;
          }
          after = {
            kind: "staff",
            role: input.role,
            value: input.value,
            effectiveFrom,
            reason,
          };
        } else if (input.kind === "referral") {
          const basisPoints = toBasisPoints(input.value);
          const existing = database
            .prepare<[string, string], ReferralRateRow>(`
              SELECT id, rate_basis_points, effective_from, reason
              FROM referral_rates
              WHERE business_id = ? AND effective_from = ? AND archived_at IS NULL
            `)
            .get(business.businessId, effectiveFrom);
          if (existing) {
            entityId = existing.id;
            before = {
              kind: "referral",
              value: existing.rate_basis_points / 100,
              effectiveFrom: existing.effective_from,
              reason: existing.reason,
            };
            database
              .prepare(
                "UPDATE referral_rates SET rate_basis_points = ?, reason = ? WHERE id = ?",
              )
              .run(basisPoints, reason, existing.id);
          } else {
            const inserted = database
              .prepare<[string, number, string, string | null], { id: string }>(
                "INSERT INTO referral_rates (business_id, rate_basis_points, effective_from, reason) VALUES (?, ?, ?, ?) RETURNING id",
              )
              .get(business.businessId, basisPoints, effectiveFrom, reason);
            if (!inserted) throw new Error("Referral rate could not be saved");
            entityId = inserted.id;
          }
          after = {
            kind: "referral",
            value: input.value,
            effectiveFrom,
            reason,
          };
        } else {
          if (!Number.isSafeInteger(input.value) || input.value < 0) {
            throw new TypeError("Tax provision must be a whole non-negative UGX amount");
          }
          const existing = database
            .prepare<[string, string], TaxRateRow>(`
              SELECT id, amount_per_unit, effective_from, reason
              FROM tax_provision_rates
              WHERE business_id = ? AND effective_from = ? AND archived_at IS NULL
            `)
            .get(business.businessId, effectiveFrom);
          if (existing) {
            entityId = existing.id;
            before = {
              kind: "taxProvision",
              value: existing.amount_per_unit,
              effectiveFrom: existing.effective_from,
              reason: existing.reason,
            };
            database
              .prepare(
                "UPDATE tax_provision_rates SET amount_per_unit = ?, reason = ? WHERE id = ?",
              )
              .run(input.value, reason, existing.id);
          } else {
            const inserted = database
              .prepare<[string, number, string, string | null], { id: string }>(
                "INSERT INTO tax_provision_rates (business_id, amount_per_unit, effective_from, reason) VALUES (?, ?, ?, ?) RETURNING id",
              )
              .get(business.businessId, input.value, effectiveFrom, reason);
            if (!inserted) throw new Error("Tax provision could not be saved");
            entityId = inserted.id;
          }
          after = {
            kind: "taxProvision",
            value: input.value,
            effectiveFrom,
            reason,
          };
        }
        if (input.kind === "referral" || input.kind === "taxProvision") {
          synchronizeCurrentValues.run({
            asOf: formatDate(now()),
            businessId: business.businessId,
          });
        }
        audit.append({
          entityType: `${input.kind}_rate`,
          entityId,
          action: "update",
          reason: reason ?? undefined,
          before,
          after,
        });
      }).immediate();

      return requireBusiness();
    },
  });
}
