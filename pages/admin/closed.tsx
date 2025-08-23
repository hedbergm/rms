import { useEffect, useState } from 'react';
import Router from 'next/router';

interface ClosedSlot { id:string; date:string; type:string; rampNumber:number|null; startMinute:number|null; durationMinutes:number|null; reason:string|null; }

const minToHHMM = (m:number|null) => m==null ? '' : `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;

export default function ClosedAdmin(){
  const [list,setList] = useState<ClosedSlot[]>([]);
  const [loading,setLoading] = useState(false);
  const [form,setForm] = useState<any>({ date:'', type:'BOTH', rampNumber:'', startMinute:'', durationMinutes:'', reason:'' });
  const load = async()=>{
    setLoading(true);
    const r = await fetch('/api/closed');
    if(r.status===403) { Router.push('/'); return; }
    const data = await r.json();
    setList(data);
    setLoading(false);
  };
  useEffect(()=>{ load(); },[]);

  const submit = async(e:any)=>{
    e.preventDefault();
    const r = await fetch('/api/closed',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form)});
    if(r.ok){ setForm({ date:'', type:'BOTH', rampNumber:'', startMinute:'', durationMinutes:'', reason:'' }); load(); }
  };

  const remove = async(id:string)=>{
    if(!confirm('Slette?')) return;
    await fetch('/api/closed?id='+id,{ method:'DELETE' });
    load();
  };

  return <div className="p-4 text-sm">
    <h1 className="text-xl mb-4 font-semibold">Stengte tider / helligdager</h1>
    <form onSubmit={submit} className="grid gap-2 md:grid-cols-6 bg-gray-800 p-3 rounded mb-6">
      <input required type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} className="bg-gray-700 p-1 rounded" />
      <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})} className="bg-gray-700 p-1 rounded">
        <option value="BOTH">Begge</option>
        <option value="LOADING">Lasting</option>
        <option value="UNLOADING">Lossing</option>
      </select>
      <input placeholder="Rampe (valgfri)" value={form.rampNumber} onChange={e=>setForm({...form,rampNumber:e.target.value})} className="bg-gray-700 p-1 rounded" />
      <input placeholder="Start (min fra 00:00)" value={form.startMinute} onChange={e=>setForm({...form,startMinute:e.target.value})} className="bg-gray-700 p-1 rounded" />
      <input placeholder="Varighet (min)" value={form.durationMinutes} onChange={e=>setForm({...form,durationMinutes:e.target.value})} className="bg-gray-700 p-1 rounded" />
      <input placeholder="Årsak / kommentar" value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} className="bg-gray-700 p-1 rounded col-span-2 md:col-span-6" />
      <div className="md:col-span-6 flex gap-2">
        <button className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded">Legg til</button>
      </div>
    </form>
    {loading && <div>Laster...</div>}
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-gray-700">
          <th className="p-2">Dato</th>
          <th className="p-2">Type</th>
          <th className="p-2">Rampe</th>
          <th className="p-2">Start</th>
          <th className="p-2">Varighet</th>
          <th className="p-2">Årsak</th>
          <th className="p-2"></th>
        </tr>
      </thead>
      <tbody>
        {list.map(c=> <tr key={c.id} className="odd:bg-gray-800 even:bg-gray-900">
          <td className="p-2">{c.date.substring(0,10)}</td>
          <td className="p-2">{c.type==='BOTH'?'Begge': c.type==='LOADING'?'Lasting':'Lossing'}</td>
          <td className="p-2">{c.rampNumber ?? ''}</td>
          <td className="p-2">{minToHHMM(c.startMinute)}</td>
            <td className="p-2">{c.durationMinutes ?? ''}</td>
          <td className="p-2">{c.reason}</td>
          <td className="p-2"><button onClick={()=>remove(c.id)} className="text-red-400 hover:underline">Slett</button></td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}
