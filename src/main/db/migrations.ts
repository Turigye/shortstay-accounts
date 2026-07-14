import type Database from "better-sqlite3-multiple-ciphers";

export const LATEST_SCHEMA_VERSION = 4;

interface Migration {
  readonly version: number;
  readonly up: (database: Database.Database) => void;
}

const MUTABLE_TABLES = [
  "accounts",
  "assets",
  "balance_snapshots",
  "booking_months",
  "bookings",
  "businesses",
  "customers",
  "expenses",
  "inventory_snapshots",
  "loans",
  "period_closes",
  "recurring_expenses",
  "referral_earnings",
  "referrers",
  "staff_earnings",
  "staff_roles",
  "suppliers",
  "units",
] as const;

const FOREIGN_KEY_COLUMNS = [
  ["accounts", "business_id"],
  ["assets", "business_id"],
  ["assets", "supplier_id"],
  ["assets", "unit_id"],
  ["balance_snapshots", "account_id"],
  ["balance_snapshots", "business_id"],
  ["balance_snapshots", "unit_id"],
  ["booking_months", "booking_id"],
  ["bookings", "business_id"],
  ["bookings", "customer_id"],
  ["bookings", "referrer_id"],
  ["bookings", "unit_id"],
  ["customers", "business_id"],
  ["expenses", "account_id"],
  ["expenses", "business_id"],
  ["expenses", "supplier_id"],
  ["expenses", "unit_id"],
  ["inventory_snapshots", "business_id"],
  ["inventory_snapshots", "unit_id"],
  ["loans", "business_id"],
  ["payments", "account_id"],
  ["payments", "booking_id"],
  ["payments", "business_id"],
  ["payments", "reversal_of_id"],
  ["period_closes", "business_id"],
  ["recurring_expenses", "business_id"],
  ["recurring_expenses", "supplier_id"],
  ["recurring_expenses", "unit_id"],
  ["referral_earnings", "booking_id"],
  ["referral_earnings", "business_id"],
  ["referral_earnings", "referrer_id"],
  ["referrers", "business_id"],
  ["staff_earnings", "booking_id"],
  ["staff_earnings", "business_id"],
  ["staff_earnings", "staff_role_id"],
  ["staff_roles", "business_id"],
  ["suppliers", "business_id"],
  ["units", "business_id"],
] as const;

const FOREIGN_KEY_INDEX_SQL = FOREIGN_KEY_COLUMNS.map(
  ([table, column]) =>
    `CREATE INDEX ${table}_${column}_idx ON ${table}(${column});`,
).join("\n");

const UPDATED_AT_TRIGGER_SQL = MUTABLE_TABLES.map(
  (table) => `
    CREATE TRIGGER ${table}_touch_updated_at
    AFTER UPDATE ON ${table}
    WHEN NEW.updated_at = OLD.updated_at
    BEGIN
      UPDATE ${table}
      SET updated_at = CASE
        WHEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') > OLD.updated_at
          THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        ELSE strftime('%Y-%m-%dT%H:%M:%fZ', OLD.updated_at, '+0.001 seconds')
      END
      WHERE id = NEW.id;
    END;
  `,
).join("\n");

const CREATE_VERSION_ONE_SCHEMA = `
  CREATE TABLE app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE businesses (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'UGX',
    tax_provision_per_unit INTEGER NOT NULL DEFAULT 600000 CHECK (tax_provision_per_unit >= 0),
    referral_rate_basis_points INTEGER NOT NULL DEFAULT 1000 CHECK (referral_rate_basis_points BETWEEN 0 AND 10000),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    archived_at TEXT
  );

  CREATE TABLE units (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    business_id TEXT NOT NULL REFERENCES businesses(id),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    archived_at TEXT,
    UNIQUE (business_id, name)
  );

  CREATE TABLE customers (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    business_id TEXT NOT NULL REFERENCES businesses(id),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    archived_at TEXT
  );

  CREATE TABLE referrers (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    business_id TEXT NOT NULL REFERENCES businesses(id),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    default_rate_basis_points INTEGER NOT NULL DEFAULT 1000 CHECK (default_rate_basis_points BETWEEN 0 AND 10000),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    archived_at TEXT
  );

  CREATE TABLE bookings (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    business_id TEXT NOT NULL REFERENCES businesses(id),
    unit_id TEXT NOT NULL REFERENCES units(id),
    customer_id TEXT NOT NULL REFERENCES customers(id),
    referrer_id TEXT REFERENCES referrers(id),
    check_in TEXT NOT NULL,
    check_out TEXT NOT NULL,
    nightly_rate INTEGER NOT NULL CHECK (nightly_rate >= 0),
    adjustment INTEGER NOT NULL DEFAULT 0,
    cleaning_fee INTEGER NOT NULL DEFAULT 0 CHECK (cleaning_fee >= 0),
    guest_tax INTEGER NOT NULL DEFAULT 0 CHECK (guest_tax >= 0),
    refundable_deposit INTEGER NOT NULL DEFAULT 0 CHECK (refundable_deposit >= 0),
    total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
    referral_rate_basis_points INTEGER CHECK (referral_rate_basis_points BETWEEN 0 AND 10000),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'checked_in', 'completed', 'cancelled')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    archived_at TEXT,
    CHECK (check_out > check_in)
  );

  CREATE TABLE booking_months (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    booking_id TEXT NOT NULL REFERENCES bookings(id),
    month TEXT NOT NULL,
    occupied_nights INTEGER NOT NULL CHECK (occupied_nights > 0),
    earned_revenue INTEGER NOT NULL CHECK (earned_revenue >= 0),
    payable_base INTEGER NOT NULL DEFAULT 0 CHECK (payable_base >= 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (booking_id, month)
  );

  CREATE TABLE accounts (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    business_id TEXT NOT NULL REFERENCES businesses(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'mobile_money', 'card', 'receivable', 'payable', 'equity', 'other')),
    currency TEXT NOT NULL DEFAULT 'UGX',
    opening_balance INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    archived_at TEXT,
    UNIQUE (business_id, name)
  );

  CREATE TABLE payments (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    business_id TEXT NOT NULL REFERENCES businesses(id),
    booking_id TEXT REFERENCES bookings(id),
    account_id TEXT NOT NULL REFERENCES accounts(id),
    direction TEXT NOT NULL CHECK (direction IN ('receipt', 'refund', 'payment', 'reversal')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    paid_at TEXT NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('cash', 'mobile_money', 'bank_transfer', 'card', 'other')),
    reference TEXT,
    related_entity_type TEXT,
    related_entity_id TEXT,
    reversal_of_id TEXT REFERENCES payments(id),
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE suppliers (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    business_id TEXT NOT NULL REFERENCES businesses(id),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    archived_at TEXT,
    UNIQUE (business_id, name)
  );

  CREATE TABLE expenses (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    business_id TEXT NOT NULL REFERENCES businesses(id),
    unit_id TEXT REFERENCES units(id),
    supplier_id TEXT REFERENCES suppliers(id),
    account_id TEXT REFERENCES accounts(id),
    category_id TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('unit', 'shared')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    expense_date TEXT NOT NULL,
    purchase_type TEXT NOT NULL DEFAULT 'cash' CHECK (purchase_type IN ('cash', 'credit')),
    payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'partial', 'unpaid')),
    due_date TEXT,
    reference TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    archived_at TEXT,
    CHECK ((scope = 'shared' AND unit_id IS NULL) OR (scope = 'unit' AND unit_id IS NOT NULL))
  );

  CREATE TABLE recurring_expenses (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    business_id TEXT NOT NULL REFERENCES businesses(id),
    unit_id TEXT REFERENCES units(id),
    supplier_id TEXT REFERENCES suppliers(id),
    category_id TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('unit', 'shared')),
    expected_amount INTEGER CHECK (expected_amount >= 0),
    cadence TEXT NOT NULL CHECK (cadence IN ('monthly', 'quarterly', 'annually')),
    next_review_month TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    archived_at TEXT
  );

  CREATE TABLE staff_roles (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    business_id TEXT NOT NULL REFERENCES businesses(id),
    role TEXT NOT NULL,
    rate_basis_points INTEGER NOT NULL CHECK (rate_basis_points BETWEEN 0 AND 10000),
    effective_from TEXT NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    archived_at TEXT,
    UNIQUE (business_id, role, effective_from)
  );

  CREATE TABLE staff_earnings (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    business_id TEXT NOT NULL REFERENCES businesses(id),
    booking_id TEXT NOT NULL REFERENCES bookings(id),
    staff_role_id TEXT NOT NULL REFERENCES staff_roles(id),
    month TEXT NOT NULL,
    eligible_base INTEGER NOT NULL CHECK (eligible_base >= 0),
    rate_basis_points INTEGER NOT NULL CHECK (rate_basis_points BETWEEN 0 AND 10000),
    earned_amount INTEGER NOT NULL CHECK (earned_amount >= 0),
    paid_amount INTEGER NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    adjustment INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (booking_id, staff_role_id, month)
  );

  CREATE TABLE referral_earnings (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    business_id TEXT NOT NULL REFERENCES businesses(id),
    booking_id TEXT NOT NULL REFERENCES bookings(id),
    referrer_id TEXT NOT NULL REFERENCES referrers(id),
    month TEXT NOT NULL,
    eligible_base INTEGER NOT NULL CHECK (eligible_base >= 0),
    rate_basis_points INTEGER NOT NULL CHECK (rate_basis_points BETWEEN 0 AND 10000),
    earned_amount INTEGER NOT NULL CHECK (earned_amount >= 0),
    paid_amount INTEGER NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    adjustment INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (booking_id, referrer_id, month)
  );

  CREATE TABLE balance_snapshots (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    business_id TEXT NOT NULL REFERENCES businesses(id),
    month TEXT NOT NULL,
    category TEXT NOT NULL,
    account_id TEXT REFERENCES accounts(id),
    unit_id TEXT REFERENCES units(id),
    amount INTEGER NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE loans (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    business_id TEXT NOT NULL REFERENCES businesses(id),
    lender TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('bank', 'non_bank', 'interest_free')),
    classification TEXT NOT NULL CHECK (classification IN ('current', 'non_current')),
    principal INTEGER NOT NULL CHECK (principal >= 0),
    outstanding_balance INTEGER NOT NULL CHECK (outstanding_balance >= 0),
    interest_rate_basis_points INTEGER NOT NULL DEFAULT 0 CHECK (interest_rate_basis_points >= 0),
    start_date TEXT NOT NULL,
    due_date TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    archived_at TEXT
  );

  CREATE TABLE assets (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    business_id TEXT NOT NULL REFERENCES businesses(id),
    unit_id TEXT REFERENCES units(id),
    supplier_id TEXT REFERENCES suppliers(id),
    category TEXT NOT NULL CHECK (category IN ('furniture', 'machinery', 'equipment', 'vehicles', 'land', 'buildings')),
    description TEXT NOT NULL,
    purchase_date TEXT NOT NULL,
    purchase_amount INTEGER NOT NULL CHECK (purchase_amount >= 0),
    payment_method TEXT,
    useful_life_months INTEGER CHECK (useful_life_months > 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disposed')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    archived_at TEXT
  );

  CREATE TABLE inventory_snapshots (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    business_id TEXT NOT NULL REFERENCES businesses(id),
    unit_id TEXT REFERENCES units(id),
    month TEXT NOT NULL,
    value INTEGER NOT NULL CHECK (value >= 0),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE period_closes (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    business_id TEXT NOT NULL REFERENCES businesses(id),
    month TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('open', 'closed', 'reopened')),
    reason TEXT,
    closed_at TEXT,
    reopened_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (business_id, month)
  );

  CREATE TABLE audit_events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'reverse', 'close', 'reopen')),
    reason TEXT,
    before_json TEXT,
    after_json TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE INDEX audit_events_entity_idx ON audit_events(entity_type, entity_id, created_at);

  ${FOREIGN_KEY_INDEX_SQL}

  ${UPDATED_AT_TRIGGER_SQL}

  CREATE TRIGGER audit_events_prevent_update
  BEFORE UPDATE ON audit_events
  BEGIN
    SELECT RAISE(ABORT, 'audit events are append-only');
  END;

  CREATE TRIGGER audit_events_prevent_delete
  BEFORE DELETE ON audit_events
  BEGIN
    SELECT RAISE(ABORT, 'audit events are append-only');
  END;
`;

const CREATE_VERSION_TWO_SCHEMA = `
  ALTER TABLE units ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

  CREATE TABLE referral_rates (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    business_id TEXT NOT NULL REFERENCES businesses(id),
    rate_basis_points INTEGER NOT NULL CHECK (rate_basis_points BETWEEN 0 AND 10000),
    effective_from TEXT NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    archived_at TEXT,
    UNIQUE (business_id, effective_from)
  );

  CREATE TABLE tax_provision_rates (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    business_id TEXT NOT NULL REFERENCES businesses(id),
    amount_per_unit INTEGER NOT NULL CHECK (amount_per_unit >= 0),
    effective_from TEXT NOT NULL,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    archived_at TEXT,
    UNIQUE (business_id, effective_from)
  );

  CREATE INDEX referral_rates_business_id_idx ON referral_rates(business_id);
  CREATE INDEX tax_provision_rates_business_id_idx ON tax_provision_rates(business_id);

  CREATE TRIGGER referral_rates_touch_updated_at
  AFTER UPDATE ON referral_rates
  WHEN NEW.updated_at = OLD.updated_at
  BEGIN
    UPDATE referral_rates
    SET updated_at = CASE
      WHEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') > OLD.updated_at
        THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      ELSE strftime('%Y-%m-%dT%H:%M:%fZ', OLD.updated_at, '+0.001 seconds')
    END
    WHERE id = NEW.id;
  END;

  CREATE TRIGGER tax_provision_rates_touch_updated_at
  AFTER UPDATE ON tax_provision_rates
  WHEN NEW.updated_at = OLD.updated_at
  BEGIN
    UPDATE tax_provision_rates
    SET updated_at = CASE
      WHEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') > OLD.updated_at
        THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      ELSE strftime('%Y-%m-%dT%H:%M:%fZ', OLD.updated_at, '+0.001 seconds')
    END
    WHERE id = NEW.id;
  END;
`;

const CREATE_VERSION_THREE_SCHEMA = `
  ALTER TABLE bookings ADD COLUMN check_in_time TEXT NOT NULL DEFAULT '14:00'
    CHECK (check_in_time GLOB '[0-2][0-9]:[0-5][0-9]');
  ALTER TABLE bookings ADD COLUMN check_out_time TEXT NOT NULL DEFAULT '11:00'
    CHECK (check_out_time GLOB '[0-2][0-9]:[0-5][0-9]');

  CREATE INDEX bookings_unit_schedule_idx
    ON bookings(business_id, unit_id, status, check_in, check_out)
    WHERE archived_at IS NULL;
`;

const CREATE_VERSION_FOUR_SCHEMA = `
  ALTER TABLE payments ADD COLUMN record_type TEXT NOT NULL DEFAULT 'receipt'
    CHECK (record_type IN ('receipt', 'refund', 'reversal', 'correction'));
  ALTER TABLE payments ADD COLUMN correction_of_id TEXT REFERENCES payments(id);
  ALTER TABLE payments ADD COLUMN additional_settlement INTEGER NOT NULL DEFAULT 0
    CHECK (additional_settlement IN (0, 1));
  ALTER TABLE payments ADD COLUMN note TEXT;

  UPDATE payments
  SET record_type = CASE
    WHEN direction = 'refund' THEN 'refund'
    WHEN direction = 'reversal' THEN 'reversal'
    ELSE 'receipt'
  END;

  UPDATE payments
  SET direction = CASE
    WHEN direction = 'payment' THEN 'receipt'
    WHEN direction = 'reversal' THEN CASE
      WHEN (SELECT original.direction FROM payments original WHERE original.id = payments.reversal_of_id) = 'refund'
        THEN 'receipt'
      ELSE 'refund'
    END
    ELSE direction
  END;

  CREATE UNIQUE INDEX payments_one_reversal_idx
    ON payments(reversal_of_id)
    WHERE reversal_of_id IS NOT NULL;
  CREATE INDEX payments_correction_of_id_idx ON payments(correction_of_id);
  CREATE INDEX payments_booking_timeline_idx
    ON payments(business_id, booking_id, paid_at, created_at, id);

  CREATE TRIGGER payments_validate_insert
  BEFORE INSERT ON payments
  WHEN
    trim(NEW.paid_at) = ''
    OR NEW.method NOT IN ('cash', 'mobile_money', 'bank_transfer', 'card')
    OR NEW.direction NOT IN ('receipt', 'refund')
    OR NOT EXISTS (
      SELECT 1 FROM businesses business
      WHERE business.id = NEW.business_id AND business.archived_at IS NULL
    )
    OR NOT EXISTS (
      SELECT 1 FROM bookings booking
      WHERE booking.id = NEW.booking_id
        AND booking.business_id = NEW.business_id
        AND booking.archived_at IS NULL
    )
    OR NOT EXISTS (
      SELECT 1 FROM accounts account
      WHERE account.id = NEW.account_id
        AND account.business_id = NEW.business_id
        AND account.archived_at IS NULL
    )
    OR (NEW.record_type = 'receipt' AND NEW.direction <> 'receipt')
    OR (NEW.record_type = 'refund' AND NEW.direction <> 'refund')
    OR (
      NEW.record_type IN ('receipt', 'refund')
      AND (NEW.reversal_of_id IS NOT NULL OR NEW.correction_of_id IS NOT NULL)
    )
    OR (
      NEW.record_type = 'reversal'
      AND (
        NEW.reversal_of_id IS NULL
        OR trim(COALESCE(NEW.reason, '')) = ''
        OR NOT EXISTS (
          SELECT 1 FROM payments original
          WHERE original.id = NEW.reversal_of_id
            AND original.business_id = NEW.business_id
            AND original.booking_id = NEW.booking_id
        )
      )
    )
    OR (
      NEW.record_type = 'correction'
      AND (
        NEW.correction_of_id IS NULL
        OR trim(COALESCE(NEW.reason, '')) = ''
        OR NOT EXISTS (
          SELECT 1 FROM payments original
          WHERE original.id = NEW.correction_of_id
            AND original.business_id = NEW.business_id
            AND original.booking_id = NEW.booking_id
        )
      )
    )
    OR (
      NEW.additional_settlement = 1
      AND (NEW.direction <> 'refund' OR trim(COALESCE(NEW.reason, '')) = '')
    )
  BEGIN
    SELECT RAISE(ABORT, 'invalid payment movement');
  END;

  CREATE TRIGGER payments_prevent_update
  BEFORE UPDATE ON payments
  BEGIN
    SELECT RAISE(ABORT, 'payment movements are append-only');
  END;

  CREATE TRIGGER payments_prevent_delete
  BEFORE DELETE ON payments
  BEGIN
    SELECT RAISE(ABORT, 'payment movements are append-only');
  END;
`;

const migrations: readonly Migration[] = [
  {
    version: 1,
    up(database) {
      database.exec(CREATE_VERSION_ONE_SCHEMA);
      database
        .prepare("insert into app_meta(key, value) values ('schema_version', ?)")
        .run(String(LATEST_SCHEMA_VERSION));
    },
  },
  {
    version: 2,
    up(database) {
      database.exec(CREATE_VERSION_TWO_SCHEMA);
      database
        .prepare("update app_meta set value = ? where key = 'schema_version'")
        .run(String(LATEST_SCHEMA_VERSION));
    },
  },
  {
    version: 3,
    up(database) {
      database.exec(CREATE_VERSION_THREE_SCHEMA);
      database
        .prepare("update app_meta set value = ? where key = 'schema_version'")
        .run(String(LATEST_SCHEMA_VERSION));
    },
  },
  {
    version: 4,
    up(database) {
      database.exec(CREATE_VERSION_FOUR_SCHEMA);
      database
        .prepare("update app_meta set value = ? where key = 'schema_version'")
        .run(String(LATEST_SCHEMA_VERSION));
    },
  },
];

export function migrateDatabase(database: Database.Database): void {
  const currentVersion = Number(
    database.pragma("user_version", { simple: true }),
  );

  if (!Number.isInteger(currentVersion) || currentVersion < 0) {
    throw new Error("Database has an invalid schema version");
  }
  if (currentVersion > LATEST_SCHEMA_VERSION) {
    throw new Error(
      `Database schema version ${currentVersion} is newer than supported version ${LATEST_SCHEMA_VERSION}`,
    );
  }

  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue;

    database.transaction(() => {
      migration.up(database);
      database.pragma(`user_version = ${migration.version}`);
    }).immediate();
  }
}
