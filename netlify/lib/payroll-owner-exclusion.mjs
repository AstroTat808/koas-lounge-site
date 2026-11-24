// Owner time is outside the employee payroll tracker. Match whole normalized names, never surnames alone.
const normalized=v=>String(v||"").toLowerCase().replace(/[^a-z0-9]/g,"");
const baseNames=["christophersibel","sibelchristopher","chrissibel","sibelchris"];
export const ownerName=v=>baseNames.includes(normalized(v));
export const ownerProfile=e=>!!e&&(ownerName(e.name)||ownerName(e.id));
export function ownerIdentity(x){
 const owners=(x.employees||[]).filter(ownerProfile),ids=new Set(owners.map(e=>e.id)),guids=new Set(owners.map(e=>e.toast_employee_guid).filter(Boolean)),names=new Set([...baseNames,...owners.flatMap(e=>(e.toast_aliases||[]).map(normalized).filter(Boolean))]);
 return {ids,guids,names};
}
export function ownerRow(t,identity){
 if(!t)return false;
 const raw=t.raw||{},fields=Object.fromEntries(Object.entries(raw).map(([k,v])=>[normalized(k),v]));
 const names=[t.employee_name,t.toast_employee_name,t.employeeName,t.employeeReference?.name,raw.toast_employee_name,raw.employeeReference?.name,fields.employeename,fields.employee,fields.name,[fields.firstname||fields.employeefirstname,fields.lastname||fields.employeelastname].filter(Boolean).join(" ")];
 return identity.ids.has(t.employee_id)||identity.guids.has(t.employeeReference?.guid)||identity.guids.has(raw.employeeReference?.guid)||names.some(v=>v&&identity.names.has(normalized(v)));
}
export function archiveOwnerTime(x){
 const identity=ownerIdentity(x),excluded=(x.entries||[]).filter(t=>ownerRow(t,identity));
 if(!excluded.length)return 0;
 // Keep prior source records for audit/retention; they are removed from the active time-entry collection.
 x.excluded_time_entries||=[];
 const seen=new Set(x.excluded_time_entries.map(t=>t.toast_guid));
 for(const t of excluded){if(!seen.has(t.toast_guid)){x.excluded_time_entries.push(t);seen.add(t.toast_guid)}}
 x.entries=x.entries.filter(t=>!ownerRow(t,identity));
 return excluded.length;
}
export function payrollScope(x){
 const identity=ownerIdentity(x);
 return {...x,employees:(x.employees||[]).filter(e=>!ownerProfile(e)),entries:(x.entries||[]).filter(t=>!ownerRow(t,identity)),runs:(x.runs||[]).filter(r=>!identity.ids.has(r.employee_id)),payments:(x.payments||[]).filter(r=>!identity.ids.has(r.employee_id)),deductions:(x.deductions||[]).filter(r=>!identity.ids.has(r.employee_id)),audit:(x.audit||[]).filter(a=>!ownerRow(a.before_data,identity)&&!ownerRow(a.after_data,identity))};
}
