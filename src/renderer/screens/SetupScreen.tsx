import { Building2, Check, KeyRound } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";

import type { IpcPayload } from "../../shared/ipc";
import { IPC_CHANNELS } from "../../shared/ipc";
import { PRODUCT_NAME } from "../../shared/product";

type CreatePayload = IpcPayload<typeof IPC_CHANNELS.BUSINESS_CREATE>;

interface SetupScreenProps {
  onCreate: (payload: CreatePayload) => Promise<void> | void;
  busy?: boolean;
  error?: string | null;
}

interface SetupErrors {
  business?: string;
  units?: string;
  password?: string;
  defaults?: string;
}

export function SetupScreen({ onCreate, busy = false, error }: SetupScreenProps) {
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<SetupErrors>({});
  const isBusy = busy || submitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("businessName") ?? "").trim();
    const unitNames = [
      String(data.get("unitOne") ?? "").trim(),
      String(data.get("unitTwo") ?? "").trim(),
    ] as [string, string];
    let password = passwordRef.current?.value ?? "";
    let confirmation = confirmationRef.current?.value ?? "";
    const approved = data.get("approvedDefaults") === "on";

    if (passwordRef.current) passwordRef.current.value = "";
    if (confirmationRef.current) confirmationRef.current.value = "";

    const nextErrors: SetupErrors = {};
    if (!name) nextErrors.business = "Enter the business name.";
    if (unitNames.some((unit) => !unit)) nextErrors.units = "Enter both unit names.";
    if (unitNames[0].toLocaleLowerCase() === unitNames[1].toLocaleLowerCase()) {
      nextErrors.units = "Unit names must be different.";
    }
    if (password.length < 10) nextErrors.password = "Use at least 10 characters.";
    if (password !== confirmation) nextErrors.password = "Passwords must match.";
    if (!approved) nextErrors.defaults = "Confirm the approved defaults to continue.";
    confirmation = "";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      password = "";
      return;
    }

    setSubmitting(true);
    const request = onCreate({ name, unitNames, password });
    password = "";
    try {
      await request;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="access-screen setup-screen">
      <aside className="access-rail">
        <div className="access-product">
          <span className="product-mark" aria-hidden="true"><Building2 size={20} /></span>
          <strong>{PRODUCT_NAME}</strong>
        </div>
        <div className="access-rail-copy">
          <KeyRound aria-hidden="true" size={24} />
          <p>Local business file</p>
          <span>No cloud account</span>
        </div>
        <p className="access-privacy"><span aria-hidden="true" /> Private on this computer</p>
      </aside>

      <section className="access-content">
        <form className="setup-form" onSubmit={handleSubmit}>
          <header className="setup-header">
            <div>
              <h1>Set up your business</h1>
              <p>Business identity, two units, and opening financial defaults.</p>
            </div>
            <span className="setup-step">First run</span>
          </header>

          {error ? <div className="form-alert" role="alert">{error}</div> : null}

          <fieldset className="form-section">
            <legend>Business</legend>
            <div className="field-group" data-invalid={Boolean(errors.business)}>
              <label htmlFor="business-name">Business name</label>
              <input id="business-name" name="businessName" autoComplete="organization" autoFocus />
              {errors.business ? <small className="field-error">{errors.business}</small> : null}
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>Initial units</legend>
            <div className="form-grid-two">
              <div className="field-group" data-invalid={Boolean(errors.units)}>
                <label htmlFor="unit-one">Unit 1 name</label>
                <input id="unit-one" name="unitOne" defaultValue="Unit 1" />
              </div>
              <div className="field-group" data-invalid={Boolean(errors.units)}>
                <label htmlFor="unit-two">Unit 2 name</label>
                <input id="unit-two" name="unitTwo" defaultValue="Unit 2" />
              </div>
            </div>
            {errors.units ? <small className="field-error section-error">{errors.units}</small> : null}
          </fieldset>

          <fieldset className="form-section">
            <legend>Local unlock</legend>
            <div className="form-grid-two">
              <div className="field-group" data-invalid={Boolean(errors.password)}>
                <label htmlFor="local-password">Local password</label>
                <input ref={passwordRef} id="local-password" name="password" type="password" autoComplete="new-password" />
              </div>
              <div className="field-group" data-invalid={Boolean(errors.password)}>
                <label htmlFor="confirm-password">Confirm password</label>
                <input ref={confirmationRef} id="confirm-password" name="confirmation" type="password" autoComplete="new-password" />
              </div>
            </div>
            {errors.password ? <small className="field-error section-error">{errors.password}</small> : null}
          </fieldset>

          <fieldset className="form-section defaults-section">
            <legend>Approved defaults</legend>
            <div className="defaults-list">
              <span><Check aria-hidden="true" size={16} />37% total staff allocation</span>
              <span><Check aria-hidden="true" size={16} />10% referral commission</span>
              <span><Check aria-hidden="true" size={16} />UGX 600,000 monthly rental basis per unit</span>
            </div>
            <label className="check-control">
              <input name="approvedDefaults" type="checkbox" />
              <span>I confirm the approved defaults</span>
            </label>
            {errors.defaults ? <small className="field-error section-error">{errors.defaults}</small> : null}
          </fieldset>

          <footer className="setup-footer">
            <div>
              <span>Monthly tax provision</span>
              <strong>UGX 115,800</strong>
            </div>
            <button className="primary-button" disabled={isBusy} type="submit">
              {isBusy ? "Creating…" : "Create business"}
            </button>
          </footer>
        </form>
      </section>
    </main>
  );
}
