import { addDays, startOfWeek, format, setHours, setMinutes, isBefore } from 'date-fns';
import { nb } from 'date-fns/locale';
import { useEffect, useState } from 'react';
import DatePicker from '../../components/DatePicker';
import { LOADING_RAMPS, UNLOADING_RAMPS } from '../../lib/availability';

interface Booking { id:string; type:string; rampNumber:number; start:string; end:string; regNr:string; company:string; goodsType:string; reference?:string; }

// Build time slots similar to availability for both types separately
function buildTimeGrid(){
  const times: string[] = [];
  const day = new Date();
  // earliest window 07:00 latest end 18:00
  let cursor = setMinutes(setHours(new Date(day),7),0);
  const end = setMinutes(setHours(new Date(day),18),0);
  while(isBefore(cursor,end)){
    times.push(new Date(cursor).toISOString().slice(11,16));
    cursor = new Date(cursor.getTime() + 60*60*1000); // 60 min coarse grid
  }
  return times; // HH:MM
}

export default function WeekView(){
  const [user,setUser]=useState<any>(null);
  const [start,setStart]=useState(()=>{
    const s = startOfWeek(new Date(),{weekStartsOn:1});
    return s.toISOString().slice(0,10);
  }); // alltid en mandag
  const [bookings,setBookings]=useState<Booking[]>([]);
  const [loading,setLoading]=useState(false);
  const [dayDetail,setDayDetail]=useState<string|null>(null); // YYYY-MM-DD
  // Beregn mandag (uten å sette state her for å unngå loop)
  const startDate = new Date(start + 'T00:00:00');
  const monday = startOfWeek(startDate,{weekStartsOn:1});
  const days = [...Array(5)].map((_,i)=> addDays(monday,i)); // Mandag-Fredag
  const times = buildTimeGrid();

  useEffect(()=>{ fetch('/api/auth/me').then(r=>r.json()).then(d=>{ if(!d.user || d.user.role!=='ADMIN') window.location.href='/'; else setUser(d.user); }); },[]);
  useEffect(()=>{ load(); },[start]);

  async function load(){
    setLoading(true);
    const r = await fetch(`/api/bookings/range?start=${start}&days=7`);
    setLoading(false);
    if(r.ok){ const j = await r.json(); setBookings(j.bookings); }
  }

  function cellBooking(type:'LOADING'|'UNLOADING', ramp:number, day:Date, time:string){
    // time HH:MM -> date
    const dateISO = day.toISOString().slice(0,10) + 'T' + time + ':00.000Z';
    // find booking with start hour matching (tolerate timezone shifts by comparing prefix)
    return bookings.find(b=> b.type===type && b.rampNumber===ramp && b.start.startsWith(day.toISOString().slice(0,10)+'T'+time));
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-semibold">Ukesoversikt</h1>
      <div className="flex gap-4 items-end flex-wrap">
        <div className="flex flex-col">
          <label className="text-xs mb-1">Uke start (mandag)</label>
          <DatePicker value={start} onChange={(v)=>{
            if(!v) return;
            const d = new Date(v + 'T00:00:00');
            const m = startOfWeek(d,{weekStartsOn:1});
            const localStr = `${m.getFullYear()}-${String(m.getMonth()+1).padStart(2,'0')}-${String(m.getDate()).padStart(2,'0')}`;
            setStart(localStr);
          }} />
          <span className="text-[10px] text-gray-500 mt-1">(Dato låses til mandag i valgt uke)</span>
        </div>
        <button onClick={load} className="bg-brand-500 hover:bg-brand-500/80 px-4 py-2 rounded text-sm">Last</button>
        {loading && <span className="text-sm">Laster...</span>}
      </div>
  <Section title="Lasting" ramps={LOADING_RAMPS} days={days} bookings={bookings} type="LOADING" cellBooking={cellBooking} onDayClick={(d:string)=>setDayDetail(d)} />
  <Section title="Lossing" ramps={UNLOADING_RAMPS} days={days} bookings={bookings} type="UNLOADING" cellBooking={cellBooking} onDayClick={(d:string)=>setDayDetail(d)} />

  {dayDetail && (
    <DayDetail date={dayDetail} bookings={bookings.filter(b=> b.start.startsWith(dayDetail))} onClose={()=>setDayDetail(null)} />
  )}
    </div>
  );
}

function Section({ title, ramps, days, type, cellBooking, bookings, onDayClick }:{ title:string; ramps:number[]; days:Date[]; times?:string[]; bookings:Booking[]; type:'LOADING'|'UNLOADING'; cellBooking:Function; onDayClick:(d:string)=>void }){
  return (
    <div>
      <h2 className="font-semibold mb-2">{title}</h2>
      <div className="overflow-auto border border-gray-700 rounded mb-6">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-800">
            <tr>
              <th className="p-2 text-left">Ramp</th>
              {days.map(d=> {
                const key = d.toISOString();
                const dayStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                return (
                  <th key={key} className="p-0 text-left">
                    <button onClick={()=>onDayClick(dayStr)} className="w-full text-left px-2 py-2 hover:bg-gray-700 focus:bg-gray-700 focus:outline-none">
                      {format(d,'EEE dd.MM', { locale: nb })}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {ramps.map(r=> (
              <tr key={r} className="border-t border-gray-800">
                <td className="p-2 font-medium">{r}</td>
                {days.map(d=> {
                  const dayKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                  const daily = (bookings||[])
                    .filter(b=> {
                      if (b.type!==type || b.rampNumber!==r) return false;
                      const dt = new Date(b.start);
                      const k = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
                      return k === dayKey;
                    })
                    .sort((a,b)=> new Date(a.start).getTime() - new Date(b.start).getTime());
                  return (
                    <td key={d.toISOString()} className="align-top p-1">
                      {daily.length ? daily.map(b=> (
                        <div key={b.id} className="mb-1 rounded bg-brand-500/20 border border-brand-500/40 p-1">
                          <div className="font-semibold text-[10px]">{new Date(b.start).toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'})}</div>
                          <div className="text-[10px] truncate">{b.company}</div>
                          <div className="text-[10px] opacity-70">{b.regNr}{b.reference ? ' • '+b.reference : ''}</div>
                        </div>
                      )):<div className="text-[10px] italic text-gray-600">Ingen</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DayDetail({ date, bookings, onClose }:{ date:string; bookings:Booking[]; onClose:()=>void }){
  const dayDate = new Date(date + 'T00:00:00');
  const sorted = [...bookings].sort((a,b)=> new Date(a.start).getTime() - new Date(b.start).getTime());
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center p-6 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h3 className="font-semibold text-sm">Bookinger {dayDate.toLocaleDateString('no-NO',{weekday:'long', day:'2-digit', month:'2-digit'})}</h3>
          <button onClick={onClose} className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded">Lukk</button>
        </div>
        <div className="overflow-auto p-4">
          {sorted.length ? (
            <table className="w-full text-xs">
              <thead className="text-gray-400">
                <tr>
                  <th className="text-left p-1">Tid</th>
                  <th className="text-left p-1">Type</th>
                  <th className="text-left p-1">Ramp</th>
                  <th className="text-left p-1">Firma</th>
                  <th className="text-left p-1">Reg nr</th>
                  <th className="text-left p-1">Ref</th>
                  <th className="text-left p-1">Gods</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(b=> (
                  <tr key={b.id} className="border-t border-gray-800">
                    <td className="p-1">{new Date(b.start).toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'})}</td>
                    <td className="p-1">{b.type==='LOADING'?'Lasting':'Lossing'}</td>
                    <td className="p-1">{b.rampNumber}</td>
                    <td className="p-1">{b.company}</td>
                    <td className="p-1">{b.regNr}</td>
                    <td className="p-1">{b.reference||''}</td>
                    <td className="p-1">{b.goodsType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="text-sm text-gray-400">Ingen bookinger denne dagen.</div>}
        </div>
      </div>
    </div>
  );
}
