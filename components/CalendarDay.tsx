import React from 'react';

interface Slot { rampNumber:number; start:string; end:string; status:'FREE'|'BOOKED'; expired?: boolean; }

export default function CalendarDay({ slots, onSlotClick }:{ slots: Slot[]; onSlotClick:(s:Slot)=>void }) {
  if(!slots.length) return <div className="mt-4">Ingen slots.</div>;
  const ramps = Array.from(new Set(slots.map(s=>s.rampNumber))).sort((a,b)=>a-b);
  // group by start
  const times = Array.from(new Set(slots.map(s=>s.start))).sort();
  return (
    <div className="mt-4 overflow-auto border border-gray-700 rounded">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-800">
          <tr>
            <th className="p-2 text-left">Tid</th>
            {ramps.map(r=> <th key={r} className="p-2 text-left">Ramp {r}</th>)}
          </tr>
        </thead>
        <tbody>
          {times.map(t=> {
            const tSlots = slots.filter(s=>s.start===t);
            const timeLabel = new Date(t).toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'});
            return (
              <tr key={t} className="border-t border-gray-800">
                <td className="p-2 font-medium">{timeLabel}</td>
                {ramps.map(r=> {
                  const slot = tSlots.find(s=>s.rampNumber===r);
                  if(!slot) return <td key={r} className="p-2" />;
          const isBooked = slot.status==='BOOKED';
          const isExpired = !!slot.expired;
          const disabled = isBooked || isExpired;
                  return (
                    <td key={r} className="p-1">
            <button disabled={disabled} onClick={()=>onSlotClick(slot)} className={`w-full rounded py-2 text-xs ${isBooked? 'bg-gray-600 text-gray-300 cursor-not-allowed': (isExpired? 'bg-gray-800 text-gray-500 cursor-not-allowed':'bg-brand-500 hover:bg-brand-500/80 text-white')}`}>{isBooked? 'Booket': (isExpired? 'For sent' : 'Ledig')}</button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
