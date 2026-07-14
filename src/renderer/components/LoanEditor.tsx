import type { FormEvent } from "react";

import { IPC_CHANNELS, type IpcPayload } from "../../shared/ipc";

export function LoanEditor({ onSave, onCancel }: { onSave:(input:IpcPayload<typeof IPC_CHANNELS.LOAN_CREATE>)=>void|Promise<void>;onCancel:()=>void }) {
  async function submit(event:FormEvent<HTMLFormElement>) { event.preventDefault();const form=new FormData(event.currentTarget);await onSave({lender:String(form.get("lender")),kind:String(form.get("kind")) as IpcPayload<typeof IPC_CHANNELS.LOAN_CREATE>["kind"],classification:String(form.get("classification")) as IpcPayload<typeof IPC_CHANNELS.LOAN_CREATE>["classification"],principal:Number(form.get("principal")),outstandingBalance:Number(form.get("outstandingBalance")),interestRateBasisPoints:Math.round(Number(form.get("interestRate"))*100),startDate:String(form.get("startDate")),dueDate:String(form.get("dueDate")||"")||null,notes:String(form.get("notes")||"")||null}); }
  return <form className="expense-editor" onSubmit={submit}>
    <label className="field-group"><span>Lender</span><input name="lender" required/></label>
    <div className="form-grid-two"><label className="field-group"><span>Loan type</span><select name="kind"><option value="bank">Bank loan</option><option value="non_bank">Non-bank loan</option><option value="interest_free">Interest-free family/friend loan</option></select></label><label className="field-group"><span>Classification</span><select name="classification"><option value="current">Under 12 months</option><option value="non_current">Over 12 months</option></select></label></div>
    <div className="form-grid-two"><label className="field-group"><span>Original principal</span><input name="principal" type="number" min="0" required/></label><label className="field-group"><span>Outstanding balance</span><input name="outstandingBalance" type="number" min="0" required/></label></div>
    <div className="form-grid-two"><label className="field-group"><span>Interest rate (%)</span><input name="interestRate" type="number" min="0" step="0.01" defaultValue="0"/></label><label className="field-group"><span>Start date</span><input name="startDate" type="date" required/></label></div>
    <label className="field-group"><span>Due date</span><input name="dueDate" type="date"/></label><label className="field-group"><span>Notes</span><textarea name="notes"/></label>
    <div className="unit-form-actions"><button className="primary-button">Save loan</button><button className="secondary-button" onClick={onCancel} type="button">Cancel</button></div>
  </form>;
}
