import { KeyRound, Pencil, Plus, UserCheck, UserX, X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import type { UserProfile } from "../../domain/users";
import { IPC_CHANNELS, type IpcFailure } from "../../shared/ipc";

function failureMessage(failure: IpcFailure): string {
  return Object.values(failure.fieldErrors)[0]?.[0] ?? failure.message;
}

export function UserManager() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [resetting, setResetting] = useState<UserProfile | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    const result = await window.stayBooks.invoke(IPC_CHANNELS.USERS_LIST, {});
    setBusy(false);
    if (!result.ok) return setError(failureMessage(result));
    setUsers(result.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function replaceUser(user: UserProfile) {
    setUsers((current) =>
      current
        .filter(({ id }) => id !== user.id)
        .concat(user)
        .sort((left, right) =>
          left.role.localeCompare(right.role) || left.name.localeCompare(right.name)),
    );
  }

  async function createEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError(null);
    const result = await window.stayBooks.invoke(IPC_CHANNELS.USER_CREATE_EDITOR, {
      name: String(data.get("name") ?? ""),
      username: String(data.get("username") ?? ""),
      password: String(data.get("password") ?? ""),
    });
    setBusy(false);
    if (!result.ok) return setError(failureMessage(result));
    replaceUser(result.data);
    form.reset();
  }

  async function updateIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    const result = await window.stayBooks.invoke(IPC_CHANNELS.USER_UPDATE, {
      id: editing.id,
      name: String(data.get("name") ?? ""),
      username: String(data.get("username") ?? ""),
    });
    setBusy(false);
    if (!result.ok) return setError(failureMessage(result));
    replaceUser(result.data);
    setEditing(null);
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetting) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    const result = await window.stayBooks.invoke(IPC_CHANNELS.USER_RESET_PASSWORD, {
      id: resetting.id,
      password: String(data.get("password") ?? ""),
    });
    setBusy(false);
    if (!result.ok) return setError(failureMessage(result));
    setResetting(null);
  }

  async function setActive(user: UserProfile) {
    setBusy(true);
    setError(null);
    const result = await window.stayBooks.invoke(IPC_CHANNELS.USER_SET_ACTIVE, {
      id: user.id,
      active: !user.active,
    });
    setBusy(false);
    if (!result.ok) return setError(failureMessage(result));
    replaceUser(result.data);
  }

  return (
    <div className="user-manager">
      <div className="panel-heading">
        <h2>Users</h2>
        <p>Editors can add bookings and record incoming payments only.</p>
      </div>
      {error ? <p className="form-alert" role="alert">{error}</p> : null}
      <form className="user-create-form" onSubmit={(event) => void createEditor(event)}>
        <label className="field-group"><span>Editor name</span><input name="name" required /></label>
        <label className="field-group"><span>Editor username</span><input autoCapitalize="none" name="username" required /></label>
        <label className="field-group"><span>Temporary password</span><input minLength={10} name="password" required type="password" /></label>
        <button className="primary-button compact-button" disabled={busy} type="submit"><Plus size={16} /> Add Editor</button>
      </form>
      <div className="user-list">
        {users.map((user) => (
          <article className="user-row" data-inactive={!user.active} key={user.id}>
            <div>
              <strong>{user.name}</strong>
              <span>@{user.username} · {user.role === "admin" ? "Admin" : "Editor"}{user.active ? "" : " · Inactive"}</span>
            </div>
            <button aria-label={`Edit ${user.name}`} className="icon-button" onClick={() => { setEditing(user); setResetting(null); }} title="Edit profile" type="button"><Pencil size={15} /></button>
            {user.role === "editor" ? (
              <>
                <button aria-label={`Reset password for ${user.name}`} className="icon-button" onClick={() => { setResetting(user); setEditing(null); }} title="Reset password" type="button"><KeyRound size={15} /></button>
                <button aria-label={`${user.active ? "Deactivate" : "Reactivate"} ${user.name}`} className="icon-button" disabled={busy} onClick={() => void setActive(user)} title={user.active ? "Deactivate Editor" : "Reactivate Editor"} type="button">{user.active ? <UserX size={15} /> : <UserCheck size={15} />}</button>
              </>
            ) : null}
          </article>
        ))}
      </div>
      {editing ? (
        <form className="user-inline-form" onSubmit={(event) => void updateIdentity(event)}>
          <header><strong>Edit {editing.name}</strong><button aria-label="Close profile editor" className="icon-button" onClick={() => setEditing(null)} type="button"><X size={15} /></button></header>
          <label className="field-group"><span>Name</span><input defaultValue={editing.name} name="name" required /></label>
          <label className="field-group"><span>Username</span><input defaultValue={editing.username} name="username" required /></label>
          <button className="primary-button compact-button" disabled={busy}>Save profile</button>
        </form>
      ) : null}
      {resetting ? (
        <form className="user-inline-form" onSubmit={(event) => void resetPassword(event)}>
          <header><strong>Reset {resetting.name}'s password</strong><button aria-label="Close password reset" className="icon-button" onClick={() => setResetting(null)} type="button"><X size={15} /></button></header>
          <label className="field-group"><span>New temporary password</span><input minLength={10} name="password" required type="password" /></label>
          <button className="primary-button compact-button" disabled={busy}>Reset password</button>
        </form>
      ) : null}
    </div>
  );
}
