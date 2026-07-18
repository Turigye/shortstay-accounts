import { AlertTriangle, Landmark, TrendingUp } from "lucide-react";

import type { InvestmentRecovery } from "../../main/db/repositories/finance-repository";

const formatUgx=(value:number)=>`UGX ${new Intl.NumberFormat("en-UG").format(value)}`;
const formatMonth=(month:string)=>new Intl.DateTimeFormat("en-UG",{month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(`${month}-01T00:00:00Z`));

export function InvestmentRecoveryPanel({recovery,onClassifyAssets}:{recovery:InvestmentRecovery;onClassifyAssets:()=>void}) {
  const chartPoints=recovery.points.slice(-12);
  const chartMaximum=Math.max(recovery.ownerInvestment,...chartPoints.map(({cumulativeNetGenerated})=>Math.max(0,cumulativeNetGenerated)),1);
  return <div className="investment-recovery" data-tour="investment-recovery">
    <section className="recovery-summary">
      <div><span>Owner-funded investment</span><strong>{formatUgx(recovery.ownerInvestment)}</strong></div>
      <div><span>Revenue to date</span><strong>{formatUgx(recovery.cumulativeRevenue)}</strong></div>
      <div><span>Net generated</span><strong className={recovery.cumulativeNetGenerated<0?"negative":""}>{formatUgx(recovery.cumulativeNetGenerated)}</strong></div>
      <div><span>Still to recover</span><strong>{formatUgx(recovery.remainingInvestment)}</strong></div>
    </section>
    <section className="recovery-progress-panel">
      <header><div><span className="section-eyebrow">Investment recovery</span><h2>{recovery.recoveryPercent}% recovered</h2><p>Net income generated toward the owner-funded cost of land, renovations, furniture, and other assets.</p></div><TrendingUp size={22}/></header>
      <div className="recovery-progress" role="progressbar" aria-label="Owner investment recovered" aria-valuemin={0} aria-valuemax={100} aria-valuenow={recovery.recoveryPercent}><span style={{width:`${recovery.recoveryPercent}%`}}/></div>
      <div className="recovery-progress-labels"><span>{formatUgx(recovery.recoveredAmount)} generated</span><span>{formatUgx(recovery.ownerInvestment)} invested</span></div>
      <p className="recovery-estimate">{recovery.remainingInvestment===0&&recovery.ownerInvestment>0?"Owner investment has been fully recovered.":recovery.estimatedPaybackMonth?`At the recent six-month average, recovery is estimated around ${formatMonth(recovery.estimatedPaybackMonth)}.`:"Add operating history or generate consistent positive net income to estimate a recovery date."}</p>
    </section>
    <div className="recovery-lower">
      <section className="recovery-chart-panel">
        <header><div><h2>Recovery progress</h2><span>Last {chartPoints.length} recorded months</span></div><span className="chart-target"><i/>Owner investment</span></header>
        {chartPoints.length?<div className="recovery-chart">{chartPoints.map((point)=><div className="recovery-chart-month" key={point.month}><div className="recovery-chart-bar"><span style={{height:`${Math.max(2,Math.max(0,point.cumulativeNetGenerated)/chartMaximum*100)}%`}}/></div><b>{formatMonth(point.month).split(" ")[0]}</b><small>{Math.round(Math.max(0,point.cumulativeNetGenerated)/1_000_000)}m</small></div>)}</div>:<div className="inline-empty"><TrendingUp size={20}/><span>Recorded income will build this chart.</span></div>}
      </section>
      <section className="funding-summary">
        <header><Landmark size={20}/><div><h2>Asset funding</h2><span>{formatUgx(recovery.totalAssetInvestment)} recorded</span></div></header>
        <dl><div><dt>Owner funded</dt><dd>{formatUgx(recovery.ownerInvestment)}</dd></div><div><dt>Loan funded</dt><dd>{formatUgx(recovery.loanFundedInvestment)}</dd></div><div><dt>Business income</dt><dd>{formatUgx(recovery.businessFundedInvestment)}</dd></div><div><dt>Not classified</dt><dd>{formatUgx(recovery.unclassifiedInvestment)}</dd></div></dl>
        {recovery.unclassifiedInvestment>0?<button className="recovery-warning" onClick={onClassifyAssets} type="button"><AlertTriangle size={16}/><span><strong>Classify existing assets</strong><small>Unclassified assets are excluded from owner recovery.</small></span></button>:null}
      </section>
    </div>
  </div>;
}
