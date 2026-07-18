import { Building2, UserRound } from "lucide-react";
import { type FormEvent, useState } from "react";

import { PRODUCT_NAME } from "../../shared/product";

interface ProfileLoginScreenProps {
  readonly businessName: string;
  readonly busy?: boolean;
  readonly error?: string | null;
  readonly onLogin: (username: string, password: string) => Promise<void> | void;
}

export function ProfileLoginScreen({
  businessName,
  busy = false,
  error,
  onLogin,
}: ProfileLoginScreenProps) {
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const isBusy = busy || submitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const username = String(data.get("username") ?? "").trim();
    let password = String(data.get("password") ?? "");
    if (!username || !password) {
      setFieldError("Enter your username and password.");
      return;
    }
    setFieldError(null);
    setSubmitting(true);
    try {
      await onLogin(username, password);
      form.reset();
    } finally {
      password = "";
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
        <form className="unlock-form profile-login-form" onSubmit={handleSubmit}>
          <span className="unlock-icon" aria-hidden="true"><UserRound size={24} /></span>
          <h1>Sign in</h1>
          <p><strong>{businessName}</strong><br />Use your local profile to continue.</p>
          {error ? <div className="form-alert" role="alert">{error}</div> : null}
          {fieldError ? <div className="form-alert" role="alert">{fieldError}</div> : null}
          <div className="field-group">
            <label htmlFor="profile-username">Username</label>
            <input
              autoCapitalize="none"
              autoComplete="username"
              autoFocus
              id="profile-username"
              name="username"
            />
          </div>
          <div className="field-group">
            <label htmlFor="profile-password">Password</label>
            <input
              autoComplete="current-password"
              id="profile-password"
              name="password"
              type="password"
            />
          </div>
          <button className="primary-button" disabled={isBusy} type="submit">
            {isBusy ? "Signing in" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
