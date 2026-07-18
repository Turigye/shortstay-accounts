import { useState, type FormEvent } from "react";
import { EXPENSE_CATEGORIES } from "../../domain/categories";
import type { BusinessUnit } from "../../domain/types";
import type { PaymentAccount } from "../../main/db/repositories/payment-repository";
import type { Supplier } from "../../main/db/repositories/expense-repository";
import { IPC_CHANNELS, type IpcPayload } from "../../shared/ipc";

type ExpenseDefaults = Partial<Pick<IpcPayload<typeof IPC_CHANNELS.EXPENSE_CREATE>, "amount" | "categoryId" | "scope" | "unitId" | "notes">>;

export function ExpenseEditor({units,accounts,suppliers,onSave,onCancel,defaults}:{units:BusinessUnit[];accounts:PaymentAccount[];suppliers:Supplier[];onSave:(value:IpcPayload<typeof IPC_CHANNELS.EXPENSE_CREATE>)=>Promise<void>|void;onCancel:()=>void;defaults?:ExpenseDefaults}){
 const [purchaseType,setPurchaseType]=useState<"cash"|"credit">("cash"); const [scope,setScope]=useState<"unit"|"shared">(defaults?.scope ?? "unit");
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);await onSave({date:String(f.get("date")),amount:Number(f.get("amount")),categoryId:String(f.get("categoryId")),scope,unitId:scope==="unit"?String(f.get("unitId")):null,purchaseType,accountId:purchaseType==="cash"?String(f.get("accountId")):null,supplierId:purchaseType==="credit"?String(f.get("supplierId")):null,dueDate:purchaseType==="credit"?String(f.get("dueDate")||"")||null:null,reference:String(f.get("reference")||"")||null,notes:String(f.get("notes")||"")||null});}
 return <form className="expense-editor" onSubmit={submit}>
  <div className="form-grid-two"><label className="field-group"><span>Date</span><input name="date" type="date" required defaultValue={new Date().toISOString().slice(0,10)}/></label><label className="field-group"><span>Amount</span><input name="amount" type="number" min="1" step="1" required defaultValue={defaults?.amount}/></label></div>
  <label className="field-group"><span>Category</span><select name="categoryId" required defaultValue={defaults?.categoryId}>{EXPENSE_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
  <div className="form-grid-two"><label className="field-group"><span>Scope</span><select value={scope} onChange={e=>setScope(e.target.value as typeof scope)}><option value="unit">Property unit</option><option value="shared">Shared</option></select></label>{scope==="unit"?<label className="field-group"><span>Unit</span><select name="unitId" required defaultValue={defaults?.unitId ?? undefined}>{units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>:null}</div>
  <label className="field-group"><span>Purchase type</span><select aria-label="Purchase type" value={purchaseType} onChange={e=>setPurchaseType(e.target.value as typeof purchaseType)}><option value="cash">Paid now</option><option value="credit">Supplier credit</option></select></label>
  {purchaseType==="cash"?<label className="field-group"><span>Payment account</span><select name="accountId" required><option value="">Choose account</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>:<div className="form-grid-two"><label className="field-group"><span>Supplier</span><select aria-label="Supplier" name="supplierId" required>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="field-group"><span>Due date</span><input aria-label="Due date" name="dueDate" type="date"/></label></div>}
  <label className="field-group"><span>Reference</span><input name="reference"/></label><label className="field-group"><span>Notes</span><textarea name="notes" defaultValue={defaults?.notes ?? undefined}/></label>
  <div className="unit-form-actions"><button className="primary-button" type="submit">Save expense</button><button className="secondary-button" type="button" onClick={onCancel}>Cancel</button></div>
 </form>;
}
