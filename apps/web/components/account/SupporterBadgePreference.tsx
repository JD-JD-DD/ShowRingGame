"use client";
import { useState } from "react";
export default function SupporterBadgePreference({ initialValue }: { initialValue: boolean }) {
 const [value,setValue]=useState(initialValue); const [message,setMessage]=useState("");
 async function save(next:boolean){setMessage(""); const response=await fetch("/api/account/supporter-badge",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({showSupporterBadge:next})}); if(!response.ok){setMessage("Unable to update your supporter badge preference.");return;} setValue(next);setMessage("Supporter badge preference saved.");}
 return <section className="theme-card mt-6 rounded-2xl p-5"><h2 className="theme-heading text-xl font-semibold">Public supporter badge</h2><p className="theme-copy mt-2 text-sm">Show or hide your supporter badge on public ShowRing pages.</p><div className="mt-4 flex gap-3"><button type="button" aria-pressed={value} onClick={()=>save(true)} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold">On</button><button type="button" aria-pressed={!value} onClick={()=>save(false)} className="theme-secondary-button rounded-xl px-4 py-2 text-sm font-semibold">Off</button></div>{message?<p role="status" className="theme-status-info mt-3 rounded-xl px-3 py-2 text-sm">{message}</p>:null}</section>;
}
