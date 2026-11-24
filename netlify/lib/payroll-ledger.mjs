// Gross wages, payments and deductions are independent records. Currency is integer cents.
const cents=n=>Number.isFinite(Number(n))?Math.max(0,Math.round((Number(n)+Number.EPSILON)*100)):0;
const pos=n=>Number.isFinite(Number(n))?Math.max(0,Number(n)):0;
const cmp=(a,b)=>String(a||"").localeCompare(String(b||""));
const shiftOrder=(a,b)=>cmp(a.business_date,b.business_date)||cmp(a.in_date,b.in_date)||cmp(a.toast_guid,b.toast_guid);
const paymentOrder=(a,b)=>cmp(a.payment_date,b.payment_date)||cmp(a.created_at,b.created_at)||cmp(a.id,b.id);
const legacyDeduction=r=>["social_security","medicare","additional_medicare","federal_income_tax","hawaii_income_tax","other_deductions"].reduce((s,k)=>s+cents(r[k]),0);
function overlaps(a,b){
 const ag=Array.isArray(a.entry_guids)&&a.entry_guids.length?a.entry_guids:null,bg=Array.isArray(b.entry_guids)&&b.entry_guids.length?b.entry_guids:null;
 if(ag&&bg){const ids=new Set(ag);return bg.some(id=>ids.has(id))}
 return !!(a.period_start&&a.period_end&&b.period_start&&b.period_end&&a.period_start<=b.period_end&&b.period_start<=a.period_end);
}
export function buildLedger(x){
 const byEmployee=Object.create(null);
 for(const e of x.employees||[]){
  const rows=(x.entries||[]).filter(t=>t.employee_id===e.id).sort(shiftOrder),old=(x.runs||[]).filter(r=>r.employee_id===e.id).sort(paymentOrder),payments=(x.payments||[]).filter(r=>r.employee_id===e.id),deductions=(x.deductions||[]).filter(r=>r.employee_id===e.id);
  // Never sum the old gross/net fields: they are repeated when the same period is paid more than once.
  const history=[...old.filter(r=>cents(r.amount_paid)>0).map(r=>({...r,kind:"payment",legacy:true,amount:cents(r.amount_paid)/100})),...payments.map(r=>({...r,kind:"payment",amount:cents(r.amount_paid)/100})),...deductions.map(r=>({...r,kind:"deduction",amount:cents(r.amount)/100}))];
  let deducted=deductions.reduce((s,r)=>s+cents(r.amount),0),legacyReview=0;
  const accepted=[];
  for(const r of old){const d=legacyDeduction(r);if(!d)continue;if(accepted.some(p=>overlaps(p,r))){legacyReview++;continue}accepted.push(r);deducted+=d;history.push({id:"legacy-deduction-"+r.id,employee_id:e.id,payment_date:r.payment_date,created_at:r.created_at,kind:"deduction",legacy:true,amount:d/100,payment_method:"Legacy payroll",payment_reference:r.payment_reference||"",notes:"Historical recorded deduction; verify against payroll records."})}
  const paid=[...old,...payments].reduce((s,r)=>s+cents(r.amount_paid),0);
  let cashLeft=paid,dedLeft=deducted,gross=0,hours=0,missingHours=0;const entries=Object.create(null);
  for(const t of rows){
   const reg=pos(t.regular_hours),ot=pos(t.overtime_hours),h=reg+ot,rate=pos(t.hourly_wage)||pos(e.hourly_rate),missing=h>0&&!rate,wage=cents((reg+ot*1.5)*rate);
   hours+=h;gross+=wage;if(missing)missingHours+=h;
   const deduction=Math.min(wage,dedLeft);dedLeft-=deduction;const cash=Math.min(wage-deduction,cashLeft);cashLeft-=cash;const covered=cash+deduction,unpaid=wage-covered;
   entries[t.toast_guid]={gross_cents:wage,paid_cents:cash,deduction_cents:deduction,covered_cents:covered,unpaid_cents:unpaid,status:missing?"rate-needed":!wage?"no-wages":!unpaid?"paid":covered?"partial":"unpaid"};
  }
  const balance=gross-deducted-paid,actual=history.filter(r=>r.kind==="payment").sort(paymentOrder);
  byEmployee[e.id]={hours:Math.round(hours*100)/100,missing_hours:Math.round(missingHours*100)/100,gross_cents:gross,deduction_cents:deducted,paid_cents:paid,balance_cents:balance,owed_cents:Math.max(0,balance),credit_cents:Math.max(0,-balance),legacy_review_count:legacyReview,entries,history:history.sort((a,b)=>paymentOrder(b,a)),last_payment:actual.at(-1)||null};
 }
 return {byEmployee};
}
