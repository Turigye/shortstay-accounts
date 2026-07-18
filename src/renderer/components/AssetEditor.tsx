import { useState, type FormEvent } from "react";

import type { BusinessUnit } from "../../domain/types";
import type { Supplier } from "../../main/db/repositories/expense-repository";
import type { AssetInput, AssetRecord } from "../../main/db/repositories/finance-repository";

export function AssetEditor({ units, suppliers, asset, onSave, onCancel }: {
  units: BusinessUnit[]; suppliers: Supplier[];
  asset?: AssetRecord | null;
  onSave: (input: AssetInput) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [fundingSource,setFundingSource]=useState<AssetInput["fundingSource"]>(asset?.fundingSource??"owner");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const purchaseAmount=Number(form.get("purchaseAmount"));
    await onSave({ category: String(form.get("category")) as AssetInput["category"], description: String(form.get("description")), purchaseDate: String(form.get("purchaseDate")), purchaseAmount, unitId: String(form.get("unitId") || "") || null, supplierId: String(form.get("supplierId") || "") || null, paymentMethod: String(form.get("paymentMethod") || "") || null, usefulLifeMonths: Number(form.get("usefulLifeMonths")) || null, fundingSource, ownerFundedAmount:fundingSource==="owner"?purchaseAmount:fundingSource==="mixed"?Number(form.get("ownerFundedAmount")):0 });
  }
  return <form className="expense-editor" onSubmit={submit}>
    <label className="field-group"><span>Category</span><select defaultValue={asset?.category} name="category"><option value="furniture">Furniture</option><option value="machinery">Machinery</option><option value="equipment">Equipment</option><option value="vehicles">Vehicles</option><option value="land">Land</option><option value="buildings">Buildings / renovations</option></select></label>
    <label className="field-group"><span>Description</span><input defaultValue={asset?.description} name="description" required/></label>
    <div className="form-grid-two"><label className="field-group"><span>Purchase date</span><input defaultValue={asset?.purchaseDate} name="purchaseDate" type="date" required/></label><label className="field-group"><span>Purchase amount</span><input defaultValue={asset?.purchaseAmount} name="purchaseAmount" type="number" min="0" required/></label></div>
    <label className="field-group"><span>How was it funded?</span><select value={fundingSource} onChange={(event)=>setFundingSource(event.target.value as AssetInput["fundingSource"])}><option value="owner">Owner funded</option><option value="loan">Loan funded</option><option value="business">Paid from business income</option><option value="mixed">Mixed funding</option><option value="unclassified">Not classified</option></select><small>This determines investment recovery; it does not create a duplicate expense.</small></label>
    {fundingSource==="mixed"?<label className="field-group"><span>Owner-funded portion</span><input defaultValue={asset?.ownerFundedAmount??0} name="ownerFundedAmount" type="number" min="0" required/><small>The remainder is treated as non-owner funding.</small></label>:null}
    <div className="form-grid-two"><label className="field-group"><span>Unit or shared</span><select defaultValue={asset?.unitId??""} name="unitId"><option value="">Shared</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label><label className="field-group"><span>Supplier</span><select defaultValue={asset?.supplierId??""} name="supplierId"><option value="">None</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label></div>
    <div className="form-grid-two"><label className="field-group"><span>Payment method</span><input defaultValue={asset?.paymentMethod??""} name="paymentMethod"/></label><label className="field-group"><span>Useful life (months)</span><input defaultValue={asset?.usefulLifeMonths??""} name="usefulLifeMonths" type="number" min="1"/></label></div>
    <div className="unit-form-actions"><button className="primary-button">{asset?"Save changes":"Save asset"}</button><button className="secondary-button" onClick={onCancel} type="button">Cancel</button></div>
  </form>;
}
