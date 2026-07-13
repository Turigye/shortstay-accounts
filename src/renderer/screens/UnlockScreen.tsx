import { Building2, LockKeyhole } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";

import { PRODUCT_NAME } from "../../shared/product";

interface UnlockScreenProps {
  onUnlock: (password: string) => Promise<void> | void;
  busy?: boolean;
  error?: string | null;
}

export function UnlockScreen({ onUnlock, busy = false, error }: UnlockScreenProps) {
  const passwordRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const isBusy = busy || submitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) return;
    let password = passwordRef.current?.value ?? "";
    if (passwordRef.current) passwordRef.current.value = "";
    if (!password) {
      setFieldError("Enter the local password.");
      return;
    }
    setFieldError(null);
    setSubmitting(true);
    const request = onUnlock(password);
    password = "";
    try {
      await request;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="access-screen unlock-screen">
      <aside className="access-rail">
        <div className="access-product">
          <span className="product-mark" aria-hidden="true"><Building2 size={20} /></span>
          <strong>{PRODUCT_NAME}</strong>
        </div>
        <p className="access-privacy"><span aria-hidden="true" /> Local and private</p>
      </aside>
      <section className="unlock-content">
        <form className="unlock-form" onSubmit={handleSubmit}>
          <span className="unlock-icon" aria-hidden="true"><LockKeyhole size={24} /></span>
          <h1>Unlock business</h1>
          <p>Open the encrypted business file on this computer.</p>
          {error ? <div className="form-alert" role="alert">{error}</div> : null}
          <div className="field-group" data-invalid={Boolean(fieldError)}>
            <label htmlFor="unlock-password">Local password</label>
            <input ref={passwordRef} id="unlock-password" type="password" autoComplete="current-password" autoFocus />
            {fieldError ? <small className="field-error">{fieldError}</small> : null}
          </div>
          <button className="primary-button" disabled={isBusy} type="submit">
            {isBusy ? "Unlocking…" : "Unlock"}
          </button>
        </form>
      </section>
    </main>
  );
}
