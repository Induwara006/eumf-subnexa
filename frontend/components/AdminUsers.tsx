"use client";
import { useEffect, useRef, useState } from "react";
import { adminProofHeaders } from "@/lib/admin-proof";
type User = {name:string;email:string;avatar_url:string;created_at:string;last_login_at:string;last_seen_at:string|null;is_blocked:boolean};
type Listing = {items:User[];total:number};
type Stats = {total:number;online:number;today:number;week:number};
const date = (value: string|null) => value ? new Date(value).toLocaleString("en-GB",{timeZone:"Asia/Colombo"}) : "—";
export default function AdminUsers({adminKey,onLock}:{adminKey:string;onLock:()=>void}) {
  const [search,setSearch]=useState(""), [query,setQuery]=useState(""), [page,setPage]=useState(1), [onlinePage,setOnlinePage]=useState(1);
  const [stats,setStats]=useState<Stats|null>(null), [users,setUsers]=useState<Listing|null>(null), [online,setOnline]=useState<Listing|null>(null);
  const [error,setError]=useState(""), [updated,setUpdated]=useState("");
  const lockRef=useRef(onLock);
  useEffect(()=>{lockRef.current=onLock;},[onLock]);
  useEffect(()=>{const t=setTimeout(()=>{setQuery(search.trim());setPage(1);},350);return ()=>clearTimeout(t);},[search]);
  useEffect(()=>{
    let cancelled=false,running=false;
    let controller: AbortController | null = null;
    const refresh=async()=>{
      if(running || document.hidden) return;
      running=true; controller=new AbortController();
      const activeController=controller;
      const timeout=setTimeout(()=>activeController.abort(),20000);
      const get=async(path:string)=>{
        const r=await fetch(`/api/library/admin/users${path}`,{headers:adminProofHeaders(adminKey),cache:"no-store",signal:activeController.signal});
        if(r.status===401||r.status===403){lockRef.current();throw new Error("Admin session ended.");}
        if(!r.ok) throw new Error("User directory unavailable. Retrying shortly.");
        return r.json();
      };
      try {
        const [a,b,c]=await Promise.all([get('/stats'),get(`?page=${page}&page_size=20&search=${encodeURIComponent(query)}`),get(`/online?page=${onlinePage}&page_size=20`)]);
        if(!cancelled){setStats(a);setUsers(b);setOnline(c);setError("");setUpdated(new Date().toLocaleTimeString());}
      } catch {if(!cancelled){setError("User directory unavailable. Displayed data may be stale.");}}
      finally {clearTimeout(timeout);running=false;}
    };
    void refresh();const timer=setInterval(()=>void refresh(),20000);
    document.addEventListener('visibilitychange',refresh);
    return ()=>{cancelled=true;controller?.abort();clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
  },[adminKey,page,onlinePage,query]);
  const table=(data:Listing|null,current:number,setCurrent:(n:number)=>void)=> <>
    <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-left text-xs">
      <thead><tr>{['User','Email','Joined','Last login','Status'].map(h=><th key={h} className="p-3">{h}</th>)}</tr></thead>
      <tbody>{data?.items.map(u=><tr key={u.email} className="border-t border-border"><td className="p-3"><div className="flex items-center gap-2">{u.avatar_url && <img src={u.avatar_url} alt="" width={28} height={28} loading="lazy" referrerPolicy="no-referrer" className="rounded-full"/>}{u.name || '—'}</div></td><td className="p-3 break-all">{u.email}</td><td className="p-3 whitespace-nowrap">{date(u.created_at)}</td><td className="p-3 whitespace-nowrap">{date(u.last_login_at)}</td><td className="p-3">{u.is_blocked?'Blocked':'Active'}</td></tr>)}</tbody>
    </table>{data && !data.items.length && <p className="p-4 text-sm">No users found.</p>}{!data && <p className="p-4">Loading…</p>}</div>
    <div className="flex items-center justify-between gap-3 text-xs"><button className="rounded border px-3 py-2 disabled:opacity-40" disabled={current===1} onClick={()=>setCurrent(current-1)}>Previous</button><span>Page {current} / {Math.max(1,Math.ceil((data?.total||0)/20))} · {data?.total??'—'} users</span><button className="rounded border px-3 py-2 disabled:opacity-40" disabled={!data||current*20>=data.total} onClick={()=>setCurrent(current+1)}>Next</button></div>
  </>;
  return <section className="space-y-5" aria-label="Users">
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[['Registered',stats?.total],['Online',stats?.online],['Joined today',stats?.today],['Joined this week',stats?.week]].map(([label,n])=><div key={label} className="rounded-xl border border-border p-4"><p className="text-xs">{label}</p><p className="text-2xl font-semibold">{n??'—'}</p></div>)}</div>
    <p className="text-xs text-body">Online = active within 90 seconds. Refreshes every 20 seconds while visible. Dates use Asia/Colombo; week starts Monday. {updated && `Updated ${updated}.`}</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <h2 className="font-semibold">Registered users</h2><input aria-label="Search registered users" placeholder="Search name or email" maxLength={100} value={search} onChange={e=>setSearch(e.target.value)} className="w-full rounded border border-border bg-background p-3 text-sm"/>
    {table(users,page,setPage)}
    <h2 className="font-semibold">Currently online</h2>{table(online,onlinePage,setOnlinePage)}
  </section>;
}
