import { Printer, X } from "lucide-react";
import { useState } from "react";

import type { ReceiptDocument } from "../../main/receipt-service";

interface ReceiptDialogProps {
  readonly receipt: ReceiptDocument;
  readonly onClose: () => void;
  readonly onPrint: (paymentId: string) => Promise<void> | void;
}

function money(value: number): string {
  return `UGX ${new Intl.NumberFormat("en-UG").format(value)}`;
}

export function ReceiptDialog({
  receipt,
  onClose,
  onPrint,
}: ReceiptDialogProps) {
  const [printing, setPrinting] = useState(false);

  async function print() {
    setPrinting(true);
    try {
      await onPrint(receipt.paymentId);
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="receipt-dialog-backdrop" role="presentation">
      <section aria-labelledby="receipt-title" aria-modal="true" className="receipt-dialog" role="dialog">
        <header>
          <div><span>{receipt.businessName}</span><h2 id="receipt-title">Payment receipt</h2></div>
          <button aria-label="Close receipt" className="icon-button" onClick={onClose} type="button"><X size={17} /></button>
        </header>
        {receipt.reversed ? <p className="receipt-reversed">Reversed</p> : null}
        <div className="receipt-reference"><span>Receipt</span><strong>{receipt.reference}</strong></div>
        <div className="receipt-amount"><span>Amount received</span><strong>{money(receipt.amount)}</strong><small>{receipt.amountWords}</small></div>
        <dl className="receipt-details">
          <div><dt>Guest</dt><dd>{receipt.guestName}</dd></div>
          <div><dt>Accommodation</dt><dd>{receipt.unitName} · {receipt.occupancyMode === "one_room" ? "One room" : "Whole unit"}</dd></div>
          <div><dt>Stay</dt><dd>{receipt.checkIn} to {receipt.checkOut}</dd></div>
          <div><dt>Payment</dt><dd>{receipt.method} · {receipt.accountName}</dd></div>
          <div><dt>Remaining balance</dt><dd>{money(receipt.remainingBalance)}</dd></div>
          <div><dt>Received by</dt><dd>{receipt.receivedBy}</dd></div>
        </dl>
        <footer>
          <button className="secondary-button" onClick={onClose} type="button">Done</button>
          <button className="primary-button" disabled={printing} onClick={() => void print()} type="button"><Printer size={16} />{printing ? "Opening print dialog" : "Print receipt"}</button>
        </footer>
      </section>
    </div>
  );
}
