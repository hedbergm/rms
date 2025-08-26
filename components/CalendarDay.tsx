import React from 'react';

interface Slot { rampNumber:number; start:string; end:string; status:'FREE'|'BOOKED'|'CLOSED'; expired?: boolean; closedReason?: string|null; }

export default function CalendarDay({ slots, onSlotClick, selectedSlot }:{ slots: Slot[]; onSlotClick:(s:Slot)=>void; selectedSlot?: Slot|null }) {
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
            // Debug the time coming from backend
            console.log('Slot time from backend:', t);
            const slotDate = new Date(t);
            console.log('Parsed slot date:', slotDate.toString(), 'Local:', slotDate.toLocaleString('no-NO'));
            const timeLabel = slotDate.toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'});
            return (
              <tr key={t} className="border-t border-gray-800">
                <td className="p-2 font-medium">{timeLabel}</td>
                {ramps.map(r=> {
                  const slot = tSlots.find(s=>s.rampNumber===r);
                  if(!slot) return <td key={r} className="p-2" />;
          const isBooked = slot.status==='BOOKED';
          const isClosed = slot.status==='CLOSED';
          const isExpired = !!slot.expired;
          const disabled = isBooked || isExpired || isClosed;
                  return (
                    <td key={r} className="p-1">
            <div className="flex justify-center">
            <button
              disabled={disabled}
              title={isClosed? (slot.closedReason||'Stengt') : (isBooked? 'Booket' : (isExpired? 'For sent' : 'Ledig'))}
              onClick={()=>onSlotClick(slot)}
              className={`w-56 h-10 px-2 rounded text-sm font-medium border flex items-center justify-center transition-colors
                ${isClosed? 'bg-red-900/40 border-red-500/40 text-red-300 cursor-not-allowed'
                : isBooked? 'bg-gray-600 border-gray-500 text-gray-300 cursor-not-allowed'
                : isExpired? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
                : selectedSlot?.rampNumber === slot.rampNumber && selectedSlot?.start === slot.start
                  ? 'bg-brand-600 border-brand-400 text-white'
                  : 'bg-brand-500 border-brand-500 hover:bg-brand-500/80 text-white'}`}
            >
              {isClosed? 'Stengt' : isBooked? 'Booket' : isExpired? 'For sent' 
                : selectedSlot?.rampNumber === slot.rampNumber && selectedSlot?.start === slot.start ? 'Valgt' : 'Ledig'}
            </button>
            </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="p-2 text-[10px] flex flex-wrap gap-4 bg-gray-800 border-t border-gray-700">
        <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-brand-500" /> Ledig</div>
        <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-gray-600" /> Booket</div>
        <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-900" /> Stengt</div>
        <div className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-gray-800 border border-gray-600" /> For sent</div>
      </div>
    </div>
  );
}
