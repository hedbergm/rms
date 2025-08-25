import { useEffect, useState } from 'react';
import Router from 'next/router';

interface ClosedSlot { id:string; date:string; type:string; rampNumber:number|null; startMinute:number|null; durationMinutes:number|null; reason:string|null; }

const minToHHMM = (m:number|null) => m==null ? '' : `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;

export default function ClosedAdmin(){
  const [list,setList] = useState<ClosedSlot[]>([]);
  const [loading,setLoading] = useState(false);
  const [form,setForm] = useState<any>({ date:'', type:'BOTH', rampNumber:'', startTime:'', endTime:'', reason:'' });
  const load = async()=>{
    setLoading(true);
    try {
      const r = await fetch('/api/closed');
      if(r.status===403) { Router.push('/'); return; }
      const data = await r.json();
      if(!Array.isArray(data)) {
        console.error('Unexpected API response:', data);
        setList([]);
      } else {
        setList(data);
      }
    } catch(error) {
      console.error('Error loading closed slots:', error);
      setList([]);
    }
    setLoading(false);
  };
  useEffect(()=>{ load(); },[]);

  const submit = async(e:any)=>{
    e.preventDefault();
    const payload = { ...form };
    // hvis begge tomme => hele dagen
    if(!payload.startTime && payload.endTime){ alert('Angi starttid'); return; }
    const r = await fetch('/api/closed',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
    if(r.ok){ setForm({ date:'', type:'BOTH', rampNumber:'', startTime:'', endTime:'', reason:'' }); load(); }
  };

  const remove = async(id:string)=>{
    if(!confirm('Slette?')) return;
    await fetch('/api/closed?id='+id,{ method:'DELETE' });
    load();
  };

  return <div className="p-4 text-sm">
    <h1 className="text-xl mb-4 font-semibold">Stengte tider / helligdager</h1>
    <form onSubmit={submit} className="grid gap-2 md:grid-cols-7 bg-gray-800 p-3 rounded mb-6 text-xs md:text-sm">
      <input required type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} className="bg-gray-700 p-1 rounded" />
      <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})} className="bg-gray-700 p-1 rounded">
        <option value="BOTH">Begge</option>
        <option value="LOADING">Lasting</option>
        <option value="UNLOADING">Lossing</option>
      </select>
      <input placeholder="Rampe (valgfri)" value={form.rampNumber} onChange={e=>setForm({...form,rampNumber:e.target.value})} className="bg-gray-700 p-1 rounded" />
      <input placeholder="Start HH:MM" value={form.startTime} onChange={e=>setForm({...form,startTime:e.target.value})} className="bg-gray-700 p-1 rounded" />
      <input placeholder="Slutt HH:MM" value={form.endTime} onChange={e=>setForm({...form,endTime:e.target.value})} className="bg-gray-700 p-1 rounded" />
      <input placeholder="Årsak / kommentar" value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} className="bg-gray-700 p-1 rounded md:col-span-2 col-span-7" />
      <div className="md:col-span-7 flex flex-wrap gap-2 items-center">
        <button className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded">Legg til</button>
        <span className="text-[10px] opacity-60">Tom start/slutt = hele dagen. Tom rampe = alle ramper.</span>
      </div>
    </form>
    {loading && <div>Laster...</div>}
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-gray-700">
          <th className="p-2">Dato</th>
          <th className="p-2">Type</th>
          <th className="p-2">Rampe</th>
          <th className="p-2">Periode</th>
          <th className="p-2">Årsak</th>
          <th className="p-2"></th>
        </tr>
      </thead>
      <tbody>
        {list.map(c=> <tr key={c.id} className="odd:bg-gray-800 even:bg-gray-900">
          <td className="p-2">{c.date.substring(0,10)}</td>
          <td className="p-2">{c.type==='BOTH'?'Begge': c.type==='LOADING'?'Lasting':'Lossing'}</td>
          <td className="p-2">{c.rampNumber ?? ''}</td>
          <td className="p-2">{c.startMinute==null? 'Hele dagen' : `${minToHHMM(c.startMinute)}${c.durationMinutes? ' - '+minToHHMM(c.startMinute + c.durationMinutes):' →'}`}</td>
          <td className="p-2">{c.reason}</td>
          <td className="p-2"><button onClick={()=>remove(c.id)} className="text-red-400 hover:underline">Slett</button></td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}
