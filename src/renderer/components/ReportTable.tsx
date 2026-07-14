export interface ReportRow { label:string;value:number;emphasis?:boolean }
const formatUgx=(value:number)=>`UGX ${new Intl.NumberFormat("en-UG").format(value)}`;
export function ReportTable({title,rows}:{title:string;rows:ReportRow[]}) { return <section className="report-table"><header><h2>{title}</h2></header><table><tbody>{rows.map((row)=><tr className={row.emphasis?"emphasis":undefined} key={row.label}><th>{row.label}</th><td>{formatUgx(row.value)}</td></tr>)}</tbody></table></section>; }
