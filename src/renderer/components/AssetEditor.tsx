import type { FormEvent } from "react";

import type { BusinessUnit } from "../../domain/types";
import type { Supplier } from "../../main/db/repositories/expense-repository";
import { IPC_CHANNELS, type IpcPayload } from "../../shared/ipc";

export function AssetEditor({ units, suppliers, onSave, onCancel }: {
  units: BusinessUnit[]; suppliers: Supplier[];
  onSave: (input: IpcPayload<typeof IPC_CHANNELS.ASSET_CREATE>) => void | Promise<void>;
  onCancel: () => void;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await onSave({ category: String(form.get("category")) as IpcPayload<typeof IPC_CHANNELS.ASSET_CREATE>["category"], description: String(form.get("description")), purchaseDate: String(form.get("purchaseDate")), purchaseAmount: Number(form.get("purchaseAmount")), unitId: String(form.get("unitId") || "") || null, supplierId: String(form.get("supplierId") || "") || null, paymentMethod: String(form.get("paymentMethod") || "") || null, usefulLifeMonths: Number(form.get("usefulLifeMonths")) || null });
  }
  return <form className="expense-editor" onSubmit={submit}>
    <label className="field-group"><span>Category</span><select name="category"><option value="furniture">Furniture</option><option value="machinery">Machinery</option><option value="equipment">Equipment</option><option value="vehicles">Vehicles</option><option value="land">Land</option><option value="buildings">Buildings</option></select></label>
    <label className="field-group"><span>Description</span><input name="description" required/></label>
    <div className="form-grid-two"><label className="field-group"><span>Purchase date</span><input name="purchaseDate" type="date" required/></label><label className="field-group"><span>Purchase amount</span><input name="purchaseAmount" type="number" min="0" required/></label></div>
    <div className="form-grid-two"><label className="field-group"><span>Unit or shared</span><select name="unitId"><option value="">Shared</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label><label className="field-group"><span>Supplier</span><select name="supplierId"><option value="">None</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label></div>
    <div className="form-grid-two"><label className="field-group"><span>Payment method</span><input name="paymentMethod"/></label><label className="field-group"><span>Useful life (months)</span><input name="usefulLifeMonths" type="number" min="1"/></label></div>
    <div className="unit-form-actions"><button className="primary-button">Save asset</button><button className="secondary-button" onClick={onCancel} type="button">Cancel</button></div>
  </form>;
}
