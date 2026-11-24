import test from "node:test";
import assert from "node:assert/strict";
import {buildLedger} from "../netlify/lib/payroll-ledger.mjs";
const e={id:"craig",hourly_rate:16},t=(id,date,h)=>({employee_id:e.id,toast_guid:id,business_date:date,regular_hours:h,hourly_wage:16}),pay=(id,amount)=>({id,employee_id:e.id,payment_date:"2026-11-23",amount_paid:amount});
const snapshot=x=>buildLedger({employees:[e],entries:[],runs:[],payments:[],deductions:[],...x}).byEmployee.craig;
test("same legacy period twice counts each cash payment and each shift once",()=>{
 const entry=t("shift","2026-11-01",11.09),runs=[250,400].map((a,i)=>({...pay("old"+i,a),period_start:"2026-11-01",period_end:"2026-11-15",entry_guids:["shift"],gross_pay:177.44,net_pay:177.44}));
 const p=snapshot({entries:[entry],runs});assert.equal(p.gross_cents,17744);assert.equal(p.paid_cents,65000);assert.equal(p.credit_cents,47256);assert.equal(p.owed_cents,0);assert.equal(p.history.length,2);
});
test("partial payments allocate oldest first and credit carries into new shifts",()=>{
 const entries=[t("new","2026-11-20",10),t("old","2026-10-01",10)];
 const p=snapshot({entries,payments:[pay("p",250)]});assert.equal(p.entries.old.status,"paid");assert.equal(p.entries.new.status,"partial");assert.equal(p.entries.new.paid_cents,9000);assert.equal(p.owed_cents,7000);
 const q=snapshot({entries,payments:[pay("p",400)]});assert.equal(q.credit_cents,8000);assert.equal(snapshot({entries:[...entries,t("third","2026-11-23",10)],payments:[pay("p",400)]}).owed_cents,8000);
});
test("deductions separate, missing rates remain unknown, overlapping legacy deductions flagged",()=>{
 const entry=t("a","2026-11-01",10),runs=[{...pay("r1",100),entry_guids:["a"],social_security:10},{...pay("r2",20),entry_guids:["a"],social_security:10}];
 const p=snapshot({entries:[entry],runs,deductions:[{id:"d",employee_id:e.id,payment_date:"2026-11-23",amount:5}]});assert.equal(p.deduction_cents,1500);assert.equal(p.legacy_review_count,1);assert.equal(p.owed_cents,2500);assert.equal(p.entries.a.paid_cents,12000);assert.equal(p.entries.a.deduction_cents,1500);
 const q=buildLedger({employees:[{id:"e",hourly_rate:0}],entries:[{employee_id:"e",toast_guid:"x",regular_hours:2}],runs:[]}).byEmployee.e;assert.equal(q.missing_hours,2);assert.equal(q.entries.x.status,"rate-needed");
});
test("correction recalculates wages without modifying a payment",()=>{
 const p=pay("p",100),a=snapshot({entries:[t("a","2026-10-01",8)],payments:[p]}),b=snapshot({entries:[t("a","2026-10-01",6)],payments:[p]});assert.equal(a.owed_cents,2800);assert.equal(b.credit_cents,400);assert.equal(p.amount_paid,100);
});
test("multiple employees never offset each other's balances",()=>{
 const p=buildLedger({employees:[e,{id:"other",hourly_rate:20}],entries:[t("a","2026-11-01",10),{employee_id:"other",toast_guid:"b",regular_hours:2,business_date:"2026-11-01"}],payments:[pay("p",200)]}).byEmployee;
 assert.equal(p.craig.credit_cents,4000);assert.equal(p.other.owed_cents,4000);
});
