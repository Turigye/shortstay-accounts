import {
  Archive,
  Banknote,
  Calculator,
  KeyRound,
  Landmark,
  ListTree,
  Plus,
  Percent,
  ShieldCheck,
  Trash2,
  Download,
  FileSpreadsheet,
  Upload,
  UserRound,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { EXPENSE_CATEGORIES } from "../../domain/categories";
import { ugx } from "../../domain/money";
import {
  calculateAnnualRentalIncome,
  calculateAnnualRentalTax,
  calculateMonthlyRentalTaxProvision,
  RENTAL_TAX_ANNUAL_THRESHOLD,
  RENTAL_TAX_RATE_PERCENT,
} from "../../domain/rental-tax";
import type { BusinessSettings, RoleKey } from "../../domain/types";
import type { PaymentAccount } from "../../main/db/repositories/payment-repository";
import type { SetRatePayload } from "../../shared/ipc";
import { IPC_CHANNELS } from "../../shared/ipc";
import { UserManager } from "../components/UserManager";

type SettingsTab =
  | "units"
  | "compensation"
  | "referral"
  | "tax"
  | "categories"
  | "accounts"
  | "backup"
  | "users"
  | "security";

interface SettingsScreenProps {
  business: BusinessSettings;
  onManageUnits: (payload: {
    units: { id?: string; name: string }[];
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
  { id: "tax", label: "Rental tax", icon: Banknote },
  { id: "categories", label: "Categories", icon: ListTree },
  { id: "accounts", label: "Accounts", icon: Archive },
  { id: "backup", label: "Backup", icon: ShieldCheck },
  { id: "users", label: "Users", icon: UserRound },
  { id: "security", label: "Security", icon: KeyRound },
] as const;

const tabTourTargets: Partial<Record<SettingsTab, string>> = {
  compensation: "effective-rates",
  tax: "tax-guidance",
  backup: "backup",
  users: "users",
  security: "security",
};

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
          {kind === "taxProvision" ? "Monthly rental income per unit" : "Rate"}
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
  onManageUnits,
  onSetRate,
  onLock,
  busy = false,
  error,
  today = todayDate(),
}: SettingsScreenProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("units");
  const [units, setUnits] = useState<{ id?: string; name: string }[]>(
    business.units.map(({ id, name }) => ({ id, name })),
  );
  const [selectedRole, setSelectedRole] = useState<RoleKey>("operations");
  const [filePassword,setFilePassword]=useState("");
  const [restoreConfirmed,setRestoreConfirmed]=useState(false);
  const [exportMonth,setExportMonth]=useState(today.slice(0,7));
  const [fileBusy,setFileBusy]=useState(false);
  const [fileMessage,setFileMessage]=useState<string|null>(null);
  const [accounts,setAccounts]=useState<PaymentAccount[]>([]);
  const [accountMessage,setAccountMessage]=useState<string|null>(null);

  useEffect(() => {
    setUnits(business.units.map(({ id, name }) => ({ id, name })));
  }, [business.units]);
  useEffect(()=>{if(activeTab!=="accounts")return;void Promise.resolve(window.stayBooks.invoke(IPC_CHANNELS.ACCOUNTS_LIST,{})).then((result)=>{if(result?.ok)setAccounts(result.data);});},[activeTab]);

  const staffTotal = useMemo(
    () => Object.values(business.staffRates).reduce((sum, value) => sum + value, 0),
    [business.staffRates],
  );
  const activeUnitCount = business.units.filter(({ status }) => status === "active").length;
  const monthlyRentalBasis = ugx(business.taxProvisionPerUnit);
  const annualRentalIncome = calculateAnnualRentalIncome(activeUnitCount, monthlyRentalBasis);
  const annualRentalTax = calculateAnnualRentalTax(activeUnitCount, monthlyRentalBasis);
  const monthlyRentalTax = calculateMonthlyRentalTaxProvision(activeUnitCount, monthlyRentalBasis);

  async function handleManageUnits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onManageUnits({
      units: units.map(({ id, name }) => ({
        ...(id ? { id } : {}),
        name: name.trim(),
      })),
    });
  }
  async function createBackup(){setFileBusy(true);setFileMessage(null);try{const result=await window.stayBooks.invoke(IPC_CHANNELS.BACKUP_CREATE,{password:filePassword});if(!result.ok)return setFileMessage(result.message);if(!result.data.cancelled)setFileMessage("Encrypted backup created.");}finally{setFileBusy(false);setFilePassword("");}}
  async function restoreBackup(){if(!restoreConfirmed)return;setFileBusy(true);setFileMessage(null);try{const result=await window.stayBooks.invoke(IPC_CHANNELS.BACKUP_RESTORE,{password:filePassword,confirmOverwrite:true});if(!result.ok)return setFileMessage(result.message);if(!result.data.cancelled)window.location.reload();}finally{setFileBusy(false);setFilePassword("");}}
  async function exportExcel(){setFileBusy(true);setFileMessage(null);const result=await window.stayBooks.invoke(IPC_CHANNELS.EXPORT_EXCEL,{month:exportMonth});setFileBusy(false);if(!result.ok)return setFileMessage(result.message);if(!result.data.cancelled)setFileMessage("Excel workbook exported.");}
  async function addAccount(event:FormEvent<HTMLFormElement>){event.preventDefault();setAccountMessage(null);const form=new FormData(event.currentTarget);const result=await window.stayBooks.invoke(IPC_CHANNELS.ACCOUNT_CREATE,{name:String(form.get("name")),type:String(form.get("type")) as "cash"|"bank"|"mobileMoney"|"card"});if(!result.ok)return setAccountMessage(result.message);setAccounts((current)=>[...current,result.data].sort((a,b)=>a.name.localeCompare(b.name)));event.currentTarget.reset();setAccountMessage("Account added.");}

  return (
    <div className="settings-screen">
      <header className="page-header settings-header">
        <div>
          <h1>Settings</h1>
          <p>{business.name}</p>
        </div>
      </header>

      {error ? <div className="form-alert" role="alert">{error}</div> : null}

      <div className="settings-layout">
        <aside aria-label="Settings navigation" className="settings-navigation">
          <div aria-label="Settings sections" className="settings-tabs" role="tablist">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                aria-selected={activeTab === id}
                className="settings-tab"
                data-tour={tabTourTargets[id as SettingsTab]}
                key={id}
                onClick={() => setActiveTab(id)}
                role="tab"
                type="button"
              >
                <span className="settings-tab-content">
                  <Icon aria-hidden="true" size={16} />
                  <span>{label}</span>
                </span>
              </button>
            ))}
          </div>

          <section aria-labelledby="backup-shortcuts-heading" className="settings-shortcuts">
            <h2 id="backup-shortcuts-heading">Backup shortcuts</h2>
            <button
              aria-label="Open Backup section for Restore"
              className="settings-shortcut"
              data-tour="restore"
              onClick={() => setActiveTab("backup")}
              title="Open Backup section for Restore"
              type="button"
            >
              <Upload aria-hidden="true" size={16} />
              <span>Restore</span>
            </button>
            <button
              aria-label="Open Backup section for Excel export"
              className="settings-shortcut"
              data-tour="excel-export"
              onClick={() => setActiveTab("backup")}
              title="Open Backup section for Excel export"
              type="button"
            >
              <FileSpreadsheet aria-hidden="true" size={16} />
              <span>Export Excel</span>
            </button>
          </section>
        </aside>

        <section className="settings-panel" role="tabpanel">
          {activeTab === "units" ? (
            <>
              <div className="panel-heading">
                <h2>Units</h2>
                <p>{units.length} active accommodation {units.length === 1 ? "unit" : "units"}</p>
              </div>
              <form className="unit-settings-form" data-tour="unit-settings" onSubmit={handleManageUnits}>
                {units.map((unit, index) => (
                  <div className="unit-setting-row" key={unit.id ?? `new-${index}`}>
                    <span className="unit-index">{index + 1}</span>
                    <div className="field-group">
                      <label htmlFor={`settings-unit-${index}`}>Unit {index + 1} name</label>
                      <input
                        id={`settings-unit-${index}`}
                        onChange={(event) => {
                          setUnits((current) =>
                            current.map((candidate, candidateIndex) =>
                              candidateIndex === index
                                ? { ...candidate, name: event.target.value }
                                : candidate,
                            ),
                          );
                        }}
                        value={unit.name}
                      />
                    </div>
                    <div className="unit-row-actions">
                      {unit.id ? <span className="status-badge" data-tone="success">Active</span> : null}
                      <button
                        aria-label={`${unit.id ? "Archive" : "Remove"} ${unit.name || `Unit ${index + 1}`}`}
                        className="icon-button"
                        disabled={units.length === 1}
                        onClick={() =>
                          setUnits((current) =>
                            current.filter((_, candidateIndex) => candidateIndex !== index),
                          )
                        }
                        title={unit.id ? "Archive unit" : "Remove unit"}
                        type="button"
                      >
                        <Trash2 aria-hidden="true" size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="unit-form-actions">
                  <button
                    className="secondary-button compact-button"
                    onClick={() => setUnits((current) => [...current, { name: "" }])}
                    type="button"
                  >
                    <Plus aria-hidden="true" size={16} /> Add unit
                  </button>
                  <button className="primary-button compact-button" disabled={busy} type="submit">
                    Save units
                  </button>
                </div>
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
                <div><h2>Rental tax</h2><p>Annual estimate for an individual landlord</p></div>
                <strong>UGX {formatNumber(annualRentalTax)} / year</strong>
              </div>
              <dl className="settings-definition-list">
                <div><dt>Annual gross rental basis</dt><dd>UGX {formatNumber(annualRentalIncome)}</dd></div>
                <div><dt>Tax-free annual threshold</dt><dd>UGX {formatNumber(RENTAL_TAX_ANNUAL_THRESHOLD)}</dd></div>
                <div><dt>Rental tax rate</dt><dd>{RENTAL_TAX_RATE_PERCENT}%</dd></div>
                <div><dt>Monthly provision</dt><dd>UGX {formatNumber(monthlyRentalTax)}</dd></div>
              </dl>
              <RateEditor
                busy={busy}
                closedMonths={business.closedMonths}
                currentValue={business.taxProvisionPerUnit}
                kind="taxProvision"
                onSave={onSetRate}
                today={today}
              />
              <p className="provision-note">Estimate: 12% of annual gross rental income above UGX 2,820,000. Confirm filings with URA or the business accountant.</p>
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
              <div className="panel-heading"><h2>Payment accounts</h2><p>Add the real places used to receive or spend money</p></div>
              <form className="settings-entry-form account-settings-form" onSubmit={addAccount}>
                <label className="field-group"><span>Account name</span><input name="name" placeholder="Visa card" required/></label>
                <label className="field-group"><span>Type</span><select name="type"><option value="cash">Cash</option><option value="bank">Bank</option><option value="mobileMoney">Mobile money</option><option value="card">Card / Visa</option></select></label>
                <button className="primary-button compact-button" type="submit"><Plus size={16}/>Add account</button>
              </form>
              {accountMessage?<p className="inline-message" role="status">{accountMessage}</p>:null}
              <div className="settings-table-wrap"><table><thead><tr><th>Account</th><th>Type</th></tr></thead><tbody>{accounts.map((account)=><tr key={account.id}><td><strong>{account.name}</strong></td><td>{account.type==="mobileMoney"?"Mobile money":account.type==="card"?"Card / Visa":account.type}</td></tr>)}</tbody></table></div>
            </>
          ) : null}

          {activeTab === "backup" ? (
            <>
              <div className="panel-heading"><h2>Backup and export</h2><p>Local files chosen by you</p></div>
              <dl className="settings-definition-list">
                <div><dt>Encryption</dt><dd>On</dd></div>
                <div><dt>Automatic upload</dt><dd>Off</dd></div>
              </dl>
              <div className="file-actions"><label className="field-group"><span>Local password</span><input type="password" value={filePassword} onChange={(event)=>setFilePassword(event.target.value)} autoComplete="current-password"/></label><div className="file-action-row"><div><strong>Encrypted backup</strong><span>Create a portable copy of the complete local business file.</span></div><button className="secondary-button" disabled={fileBusy||!filePassword} onClick={()=>void createBackup()} type="button"><Download size={16}/>Create backup</button></div><label className="restore-confirm"><input type="checkbox" checked={restoreConfirmed} onChange={(event)=>setRestoreConfirmed(event.target.checked)}/><span>I understand restore replaces the current local business file.</span></label><div className="file-action-row"><div><strong>Restore backup</strong><span>Validate an encrypted backup before replacing this file.</span></div><button className="secondary-button" disabled={fileBusy||!filePassword||!restoreConfirmed} onClick={()=>void restoreBackup()} type="button"><Upload size={16}/>Restore</button></div><div className="file-action-row"><label className="field-group"><span>Export month</span><input type="month" value={exportMonth} onChange={(event)=>setExportMonth(event.target.value)}/></label><button className="primary-button" disabled={fileBusy} onClick={()=>void exportExcel()} type="button"><FileSpreadsheet size={16}/>Export Excel</button></div>{fileMessage?<p className="inline-message" role="status">{fileMessage}</p>:null}</div>
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
          {activeTab === "users" ? <UserManager /> : null}
        </section>
      </div>
    </div>
  );
}
