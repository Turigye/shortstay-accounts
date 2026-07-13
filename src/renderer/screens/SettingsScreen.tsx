import {
  Archive,
  Banknote,
  Calculator,
  KeyRound,
  Landmark,
  ListTree,
  Percent,
  ShieldCheck,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { EXPENSE_CATEGORIES } from "../../domain/categories";
import type { BusinessSettings, RoleKey } from "../../domain/types";
import type { SetRatePayload } from "../../shared/ipc";

type SettingsTab =
  | "units"
  | "compensation"
  | "referral"
  | "tax"
  | "categories"
  | "accounts"
  | "backup"
  | "security";

interface SettingsScreenProps {
  business: BusinessSettings;
  onRenameUnits: (payload: {
    units: [{ id: string; name: string }, { id: string; name: string }];
  }) => Promise<void> | void;
  onSetRate: (payload: SetRatePayload) => Promise<void> | void;
  onLock: () => Promise<void> | void;
  busy?: boolean;
  error?: string | null;
  today?: string;
}

const ROLE_LABELS: Record<RoleKey, string> = {
  operations: "Operations Manager",
  salesMarketing: "Sales and Marketing",
  finance: "Finance",
  itLegal: "IT and Legal",
  security: "Security",
  ceo: "CEO",
};

const TABS = [
  { id: "units", label: "Units", icon: Landmark },
  { id: "compensation", label: "Compensation", icon: Calculator },
  { id: "referral", label: "Referral", icon: Percent },
  { id: "tax", label: "Tax provision", icon: Banknote },
  { id: "categories", label: "Categories", icon: ListTree },
  { id: "accounts", label: "Accounts", icon: Archive },
  { id: "backup", label: "Backup", icon: ShieldCheck },
  { id: "security", label: "Security", icon: KeyRound },
] as const;

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-UG").format(value);
}

interface RateEditorProps {
  kind: "staff" | "referral" | "taxProvision";
  role?: RoleKey;
  currentValue: number;
  today: string;
  closedMonths: readonly string[];
  onSave: SettingsScreenProps["onSetRate"];
  busy: boolean;
  existingStaffTotal?: number;
}

function RateEditor({
  kind,
  role,
  currentValue,
  today,
  closedMonths,
  onSave,
  busy,
  existingStaffTotal = 0,
}: RateEditorProps) {
  const [value, setValue] = useState(String(currentValue));
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const month = effectiveFrom.slice(0, 7);
  const historical = month < today.slice(0, 7);
  const closed = closedMonths.includes(month);
  const reasonRequired = historical || closed;
  const numericValue = Number(value);
  const exceedsStaffLimit =
    kind === "staff" && Number.isFinite(numericValue) && existingStaffTotal + numericValue > 100;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      setError("Enter a valid non-negative value.");
      return;
    }
    if (reasonRequired && !reason.trim()) {
      setError("Enter a reason for this effective date.");
      return;
    }
    setError(null);
    const common = {
      value: numericValue,
      effectiveFrom,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    };
    if (kind === "staff" && role) {
      await onSave({ kind, role, ...common });
    } else if (kind !== "staff") {
      await onSave({ kind, ...common });
    }
  }

  return (
    <form className="rate-editor" onSubmit={handleSubmit}>
      <div className="field-group">
        <label htmlFor={`${kind}-value`}>
          {kind === "taxProvision" ? "Amount per unit" : "Rate"}
        </label>
        <div className={kind === "taxProvision" ? "input-with-prefix" : "input-with-suffix"}>
          {kind === "taxProvision" ? <span>UGX</span> : null}
          <input
            id={`${kind}-value`}
            inputMode="decimal"
            min="0"
            max={kind === "taxProvision" ? undefined : "100"}
            onChange={(event) => setValue(event.target.value)}
            step={kind === "taxProvision" ? "1" : "0.01"}
            type="number"
            value={value}
          />
          {kind !== "taxProvision" ? <span>%</span> : null}
        </div>
      </div>
      <div className="field-group">
        <label htmlFor={`${kind}-effective-from`}>Effective from</label>
        <input
          id={`${kind}-effective-from`}
          onChange={(event) => setEffectiveFrom(event.target.value)}
          type="date"
          value={effectiveFrom}
        />
      </div>
      <div className="field-group rate-reason">
        <label htmlFor={`${kind}-reason`}>
          {reasonRequired ? "Reason for historical change" : "Reason (optional)"}
        </label>
        <input
          id={`${kind}-reason`}
          onChange={(event) => setReason(event.target.value)}
          required={reasonRequired}
          value={reason}
        />
        {reasonRequired ? (
          <small>
            Required because this date is in a {closed ? "closed" : "historical"} period.
          </small>
        ) : null}
      </div>
      <button className="primary-button compact-button" disabled={busy} type="submit">
        Save rate
      </button>
      {exceedsStaffLimit ? (
        <p className="inline-warning" role="status">
          The combined staff allocation would exceed 100%.
        </p>
      ) : null}
      {error ? <p className="field-error rate-error" role="alert">{error}</p> : null}
    </form>
  );
}

export function SettingsScreen({
  business,
  onRenameUnits,
  onSetRate,
  onLock,
  busy = false,
  error,
  today = todayDate(),
}: SettingsScreenProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("units");
  const [unitNames, setUnitNames] = useState<[string, string]>([
    business.units[0]?.name ?? "",
    business.units[1]?.name ?? "",
  ]);
  const [selectedRole, setSelectedRole] = useState<RoleKey>("operations");

  useEffect(() => {
    setUnitNames([business.units[0]?.name ?? "", business.units[1]?.name ?? ""]);
  }, [business.units]);

  const staffTotal = useMemo(
    () => Object.values(business.staffRates).reduce((sum, value) => sum + value, 0),
    [business.staffRates],
  );

  async function handleRenameUnits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (business.units.length !== 2) return;
    await onRenameUnits({
      units: [
        { id: business.units[0].id, name: unitNames[0].trim() },
        { id: business.units[1].id, name: unitNames[1].trim() },
      ],
    });
  }

  return (
    <div className="settings-screen">
      <header className="page-header settings-header">
        <div>
          <h1>Settings</h1>
          <p>{business.name}</p>
        </div>
        <span className="settings-currency">UGX</span>
      </header>

      {error ? <div className="form-alert" role="alert">{error}</div> : null}

      <div className="settings-layout">
        <div className="settings-tabs" role="tablist" aria-label="Settings sections">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              aria-selected={activeTab === id}
              className="settings-tab"
              key={id}
              onClick={() => setActiveTab(id)}
              role="tab"
              type="button"
            >
              <Icon aria-hidden="true" size={16} />
              {label}
            </button>
          ))}
        </div>

        <section className="settings-panel" role="tabpanel">
          {activeTab === "units" ? (
            <>
              <div className="panel-heading">
                <h2>Units</h2>
                <p>Two active accommodation units</p>
              </div>
              <form className="unit-settings-form" onSubmit={handleRenameUnits}>
                {unitNames.map((name, index) => (
                  <div className="unit-setting-row" key={business.units[index]?.id}>
                    <span className="unit-index">{index + 1}</span>
                    <div className="field-group">
                      <label htmlFor={`settings-unit-${index}`}>Unit {index + 1} name</label>
                      <input
                        id={`settings-unit-${index}`}
                        onChange={(event) => {
                          const next = [...unitNames] as [string, string];
                          next[index] = event.target.value;
                          setUnitNames(next);
                        }}
                        value={name}
                      />
                    </div>
                    <span className="status-badge" data-tone="success">Active</span>
                  </div>
                ))}
                <button className="primary-button compact-button" disabled={busy} type="submit">
                  Save unit names
                </button>
              </form>
            </>
          ) : null}

          {activeTab === "compensation" ? (
            <>
              <div className="panel-heading panel-heading-split">
                <div><h2>Compensation</h2><p>Effective-dated role allocations</p></div>
                <strong>{staffTotal}% total</strong>
              </div>
              <div className="rate-summary-grid">
                {Object.entries(business.staffRates).map(([role, rate]) => (
                  <button
                    className="rate-summary-row"
                    data-selected={selectedRole === role}
                    key={role}
                    onClick={() => setSelectedRole(role as RoleKey)}
                    type="button"
                  >
                    <span>{ROLE_LABELS[role as RoleKey]}</span><strong>{rate}%</strong>
                  </button>
                ))}
              </div>
              <RateEditor
                key={selectedRole}
                busy={busy}
                closedMonths={business.closedMonths}
                currentValue={business.staffRates[selectedRole]}
                existingStaffTotal={staffTotal - business.staffRates[selectedRole]}
                kind="staff"
                onSave={onSetRate}
                role={selectedRole}
                today={today}
              />
            </>
          ) : null}

          {activeTab === "referral" ? (
            <>
              <div className="panel-heading panel-heading-split">
                <div><h2>Referral</h2><p>Default commission for referred bookings</p></div>
                <strong>{business.referralRate}%</strong>
              </div>
              <RateEditor
                busy={busy}
                closedMonths={business.closedMonths}
                currentValue={business.referralRate}
                kind="referral"
                onSave={onSetRate}
                today={today}
              />
            </>
          ) : null}

          {activeTab === "tax" ? (
            <>
              <div className="panel-heading panel-heading-split">
                <div><h2>Tax provision</h2><p>Manual monthly planning amount per unit</p></div>
                <strong>UGX {formatNumber(business.taxProvisionPerUnit * business.units.length)}</strong>
              </div>
              <RateEditor
                busy={busy}
                closedMonths={business.closedMonths}
                currentValue={business.taxProvisionPerUnit}
                kind="taxProvision"
                onSave={onSetRate}
                today={today}
              />
              <p className="provision-note">Manual provision, separate from statutory assessment.</p>
            </>
          ) : null}

          {activeTab === "categories" ? (
            <>
              <div className="panel-heading"><h2>Categories</h2><p>{EXPENSE_CATEGORIES.length} approved expense categories</p></div>
              <div className="settings-table-wrap">
                <table><thead><tr><th>Category</th><th>Group</th><th>Default scope</th></tr></thead>
                  <tbody>{EXPENSE_CATEGORIES.map((category) => (
                    <tr key={category.id}><td>{category.label}</td><td>{category.group}</td><td>{category.defaultScope === "unit" ? "Unit" : "Shared"}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          ) : null}

          {activeTab === "accounts" ? (
            <>
              <div className="panel-heading"><h2>Accounts</h2><p>Available local account classifications</p></div>
              <dl className="settings-definition-list">
                <div><dt>Money accounts</dt><dd>Cash, bank, mobile money, card</dd></div>
                <div><dt>Working balances</dt><dd>Receivable, payable</dd></div>
                <div><dt>Ownership</dt><dd>Equity and other balances</dd></div>
              </dl>
            </>
          ) : null}

          {activeTab === "backup" ? (
            <>
              <div className="panel-heading"><h2>Backup</h2><p>Local encrypted business file</p></div>
              <dl className="settings-definition-list">
                <div><dt>Encryption</dt><dd>On</dd></div>
                <div><dt>Automatic upload</dt><dd>Off</dd></div>
                <div><dt>Local schedule</dt><dd>Not configured</dd></div>
              </dl>
            </>
          ) : null}

          {activeTab === "security" ? (
            <>
              <div className="panel-heading"><h2>Security</h2><p>Encrypted local access</p></div>
              <div className="security-setting-row">
                <div><strong>Business file</strong><span>Currently unlocked</span></div>
                <button className="secondary-button" disabled={busy} onClick={() => void onLock()} type="button">
                  <KeyRound aria-hidden="true" size={16} /> Lock now
                </button>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
