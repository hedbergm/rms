import { useState, useEffect, useRef } from 'react';
import { addDays, startOfWeek, isSameDay, format } from 'date-fns';
import { nb } from 'date-fns/locale';

interface Props { value: string; onChange: (v:string)=>void; disabledPast?: boolean; }

// Simple, dependency-free date picker (YYYY-MM-DD) with Monday as first day
export default function DatePicker({ value, onChange, disabledPast }: Props){
  const [open,setOpen]=useState(false);
  const [month,setMonth]=useState(()=> value? new Date(value+'T00:00:00') : new Date());
  const ref = useRef<HTMLDivElement|null>(null);
  useEffect(()=>{ function onDoc(e:MouseEvent){ if(ref.current && !ref.current.contains(e.target as any)) setOpen(false); } document.addEventListener('mousedown',onDoc); return ()=>document.removeEventListener('mousedown',onDoc); },[]);
  const selDate = value? new Date(value+'T00:00:00') : null;
  const first = startOfWeek(new Date(month.getFullYear(), month.getMonth(), 1), { weekStartsOn:1 });
  const weeks: Date[][] = [];
  let cursor = first;
  while(true){
    const week: Date[] = [];
    for(let i=0;i<7;i++){ week.push(cursor); cursor = addDays(cursor,1); }
    weeks.push(week);
    // stop after we've passed the end of the visible month and landed on next month's Monday
    const last = week[6];
    if(last.getMonth() !== month.getMonth() && last.getDay() === 1) break;
    if(weeks.length>6) break; // safety
  }
  function fmt(d:Date){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  const todayStr = fmt(new Date());
  const isPast = (d:Date)=> disabledPast && fmt(d) < todayStr;
  return (
    <div className="relative inline-block" ref={ref}>
      <div className="flex items-center gap-1">
        <input readOnly value={value} onClick={()=>setOpen(o=>!o)} className="bg-gray-800 p-2 rounded cursor-pointer select-none w-36" />
        <button type="button" onClick={()=>setOpen(o=>!o)} className="text-xs px-2 py-1 bg-gray-700 rounded">📅</button>
      </div>
      {open && (
        <div className="absolute z-30 mt-2 p-3 bg-gray-900 border border-gray-700 rounded shadow-lg w-72">
          <div className="flex justify-between items-center mb-2 text-sm">
            <button onClick={()=>setMonth(m=> new Date(m.getFullYear(), m.getMonth()-1, 1))} className="px-2 py-1 hover:bg-gray-700 rounded" aria-label="Forrige måned">◀</button>
            <div className="font-medium">{format(month,'MMMM yyyy', { locale: nb })}</div>
            <button onClick={()=>setMonth(m=> new Date(m.getFullYear(), m.getMonth()+1, 1))} className="px-2 py-1 hover:bg-gray-700 rounded" aria-label="Neste måned">▶</button>
          </div>
          <table className="w-full text-xs select-none">
            <thead>
              <tr className="text-gray-400">
                {['Ma','Ti','On','To','Fr','Lø','Sø'].map(d=> <th key={d} className="h-6 font-normal">{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {weeks.map((w,i)=> (
                <tr key={i}>
                  {w.map(d=> {
                    const dStr = fmt(d);
                    const selected = selDate && isSameDay(selDate,d);
                    const muted = d.getMonth() !== month.getMonth();
                    const disabled = isPast(d);
                    return (
                      <td key={dStr} className="p-0">
                        <button disabled={disabled} onClick={()=>{ onChange(dStr); setOpen(false); }} className={`w-8 h-8 m-0.5 rounded text-sm flex items-center justify-center
                          ${selected?'bg-brand-500 text-white':''}
                          ${!selected && !disabled ? 'hover:bg-gray-700':''}
                          ${muted? 'text-gray-600':''}
                          ${disabled? 'opacity-30 cursor-not-allowed':''}`}>{d.getDate()}</button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between mt-2 text-[11px] text-gray-400">
            <button onClick={()=>{ onChange(todayStr); setMonth(new Date()); }} className="hover:text-gray-200">I dag</button>
            <button onClick={()=>{ onChange(''); }} className="hover:text-gray-200">Tøm</button>
          </div>
        </div>
      )}
    </div>
  );
}