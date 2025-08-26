import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import CalendarDay from '../components/CalendarDay';
import DatePicker from '../components/DatePicker';

interface BookingFormState {
  type: 'LOADING' | 'UNLOADING';
  regNr: string; company: string; email: string; phone: string; goodsType: 'IFCO' | 'GEN_CARGO'; reference?: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [type, setType] = useState<'LOADING'|'UNLOADING'>('LOADING');
  const [slots, setSlots] = useState<any[]>([]);
  const [form, setForm] = useState<BookingFormState>({ type: 'LOADING', regNr:'', company:'', email:'', phone:'', goodsType:'IFCO', reference:'' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(()=>{ fetch('/api/auth/me').then(r=>r.json()).then(d=>{ if(d?.user) setUser(d.user); else router.push('/'); }); },[router]);
  useEffect(()=>{ loadSlots(); },[date, type]);

  async function loadSlots(){
    const res = await fetch(`/api/availability?date=${date}&type=${type}`);
    if(res.ok){ setSlots(await res.json()); }
  }

  const [selectedSlot, setSelectedSlot] = useState<any>(null);

  function onSlotClick(slot:any){
    if(slot.status==='BOOKED') return;
    setSelectedSlot(slot === selectedSlot ? null : slot);
    setMessage('');
  }

  async function book(){
    if(!selectedSlot) return;
    
    // Validate form
    if(!form.regNr) return setMessage('Registreringsnummer må fylles ut');
    if(!form.company) return setMessage('Firmanavn må fylles ut');
    if(!form.email) return setMessage('Epost må fylles ut');
    if(!form.phone) return setMessage('Telefon må fylles ut');
    
    setLoading(true);
    setMessage('');
    
    const body = { ...form, type, rampNumber: selectedSlot.rampNumber, start: selectedSlot.start };
    const res = await fetch('/api/bookings', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
    
    if(res.ok){ 
      setMessage('Booket!');
      setSelectedSlot(null);
      loadSlots();
    } else {
      const d = await res.json().catch(()=>({message:'Feil'}));
      setMessage(d.message||'Feil');
    }
    setLoading(false);
  }

  async function logout(){ await fetch('/api/auth/logout',{method:'POST'}); router.push('/'); }
  const [menuOpen,setMenuOpen]=useState(false);
  const menuRef = useRef<HTMLDivElement|null>(null);
  useEffect(()=>{
    function onDoc(e:MouseEvent){ if(menuRef.current && !menuRef.current.contains(e.target as any)) setMenuOpen(false); }
    document.addEventListener('mousedown', onDoc); return ()=>document.removeEventListener('mousedown', onDoc);
  },[]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">RMS Dashboard</h1>
        <div className="relative" ref={menuRef}>
          <button onClick={()=>setMenuOpen(o=>!o)} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded text-sm">
            <span className="truncate max-w-[160px]" title={user?.email}>{user?.email}</span>
            <span className="text-[10px] bg-brand-500/30 px-1 py-0.5 rounded">{user?.role}</span>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" className={`transition-transform ${menuOpen?'rotate-180':''}`}><path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded shadow-lg py-1 text-sm z-20">
              <button onClick={()=>{ setMenuOpen(false); router.push('/password'); }} className="w-full text-left px-3 py-2 hover:bg-gray-700">Endre passord</button>
              {user?.role==='ADMIN' && <>
                <button onClick={()=>{ setMenuOpen(false); window.open('/admin/week','_blank'); }} className="w-full text-left px-3 py-2 hover:bg-gray-700">Ukesvisning</button>
                <button onClick={()=>{ setMenuOpen(false); window.open('/admin/closed','_blank'); }} className="w-full text-left px-3 py-2 hover:bg-gray-700">Steng tider</button>
              </>}
              <div className="h-px bg-gray-700 my-1" />
              <button onClick={logout} className="w-full text-left px-3 py-2 hover:bg-gray-700 text-red-300">Logg ut</button>
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-4 flex-wrap">
        <div className="space-y-2">
          <label className="block text-sm">Dato</label>
          <DatePicker value={date} onChange={(v)=>{ if(v) setDate(v); }} />
        </div>
        <div className="space-y-2">
          <label className="block text-sm">Type</label>
          <select value={type} onChange={e=>setType(e.target.value as any)} className="bg-gray-800 p-2 rounded">
            <option value="LOADING">Lasting</option>
            <option value="UNLOADING">Lossing</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="block text-sm">Reg nr</label>
          <input value={form.regNr} onChange={e=>setForm(f=>({...f,regNr:e.target.value}))} className="bg-gray-800 p-2 rounded" />
        </div>
        <div className="space-y-2">
          <label className="block text-sm">Firmanavn</label>
          <input value={form.company} onChange={e=>setForm(f=>({...f,company:e.target.value}))} className="bg-gray-800 p-2 rounded" />
        </div>
        <div className="space-y-2">
          <label className="block text-sm">Epost</label>
          <input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} className="bg-gray-800 p-2 rounded" />
        </div>
        <div className="space-y-2">
          <label className="block text-sm">Telefon</label>
            <input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} className="bg-gray-800 p-2 rounded" />
        </div>
        <div className="space-y-2">
          <label className="block text-sm">Gods</label>
          <select value={form.goodsType} onChange={e=>setForm(f=>({...f,goodsType:e.target.value as any}))} className="bg-gray-800 p-2 rounded">
            <option value="IFCO">IFCO</option>
            <option value="GEN_CARGO">Gen Cargo</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="block text-sm">Referanse</label>
          <input value={form.reference||''} onChange={e=>setForm(f=>({...f,reference:e.target.value}))} className="bg-gray-800 p-2 rounded" placeholder="Ordrenr / referanse" />
        </div>
      </div>
      {message && <div className={`text-sm ${message === 'Booket!' ? 'text-green-400' : 'text-red-400'}`}>{message}</div>}
      <CalendarDay slots={slots} onSlotClick={onSlotClick} selectedSlot={selectedSlot} />
      {selectedSlot && (
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={book}
            disabled={loading}
            className="bg-brand-500 hover:bg-brand-500/80 disabled:opacity-50 px-6 py-2 rounded text-sm flex items-center gap-2"
          >
            {loading ? <>
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Booker...
            </> : 'Book valgt tid'}
          </button>
          <span className="text-sm text-gray-400">
            {new Date(selectedSlot.start).toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'})} - Rampe {selectedSlot.rampNumber}
          </span>
        </div>
      )}
      {user?.role === 'ADMIN' && (
        <>
          <div>
            <div className="flex gap-2 mb-2">
              <button onClick={()=>window.open('/admin/week','_blank')} className="bg-brand-500 hover:bg-brand-500/80 px-3 py-1 rounded text-xs">Ukesvisning</button>
            </div>
          </div>
          <AdminPanel date={date} />
          <AdminUsers />
        </>
      )}
      {loading && <div>Booking...</div>}
    </div>
  );
}

function AdminPanel({ date }: { date: string }) {
  const [bookings,setBookings]=useState<any[]>([]);
  useEffect(()=>{ loadBookings(); },[date]);
  async function loadBookings(){
    const r = await fetch(`/api/bookings?date=${date}`);
    if(r.ok) setBookings(await r.json());
  }
  return (
    <div className="mt-8">
      <h2 className="font-semibold mb-2">Admin Bookinger ({date})</h2>
      <div className="overflow-auto border border-gray-700 rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-800">
            <tr>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Ramp</th>
              <th className="p-2 text-left">Start</th>
              <th className="p-2 text-left">Reg nr</th>
              <th className="p-2 text-left">Firma</th>
              <th className="p-2 text-left">Epost</th>
              <th className="p-2 text-left">Tlf</th>
              <th className="p-2 text-left">Gods</th>
              <th className="p-2 text-left">Bruker</th>
              <th className="p-2 text-left">Ref</th>
              <th className="p-2 text-left">Handling</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map(b=> (
              <tr key={b.id} className="border-t border-gray-800">
                <td className="p-2">{b.type==='LOADING'?'Lasting':'Lossing'}</td>
                <td className="p-2">{b.rampNumber}</td>
                <td className="p-2">{new Date(b.start).toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'})}</td>
                <td className="p-2">{b.regNr}</td>
                <td className="p-2">{b.company}</td>
                <td className="p-2">{b.email}</td>
                <td className="p-2">{b.phone}</td>
                <td className="p-2">{b.goodsType}</td>
                <td className="p-2">{b.user?.email}</td>
                <td className="p-2">{b.reference || ''}</td>
                <td className="p-2">
                  <button
                    onClick={async ()=>{
                      if(!confirm('Slette booking?')) return;
                      const r = await fetch(`/api/bookings?id=${b.id}`, { method:'DELETE' });
                      if(r.ok) loadBookings(); else alert('Feil ved sletting');
                    }}
                    className="text-red-400 hover:text-red-300 text-xs underline"
                  >Slett</button>
                </td>
              </tr>
            ))}
            {!bookings.length && <tr><td className="p-2" colSpan={11}>Ingen</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'USER'|'ADMIN'>('USER');
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    const r = await fetch('/api/users');
    if (r.ok) setUsers(await r.json());
  }
  useEffect(()=>{ load(); },[]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    if(!email) return;
    setCreating(true); setMsg('');
  const payload: any = { email, role };
    if (password.trim()) payload.password = password.trim();
    const r = await fetch('/api/users', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    setCreating(false);
    if(r.ok){
      const data = await r.json();
      setMsg(`Bruker opprettet. Passord: ${data.password || '(tilsendt epost)'}`);
      setEmail(''); setPassword('');
      load();
    } else {
      const d = await r.json().catch(()=>({message:'Feil'}));
      setMsg(d.message || 'Feil ved opprettelse');
    }
  }

  return (
    <div className="mt-12">
      <h2 className="font-semibold mb-2">Admin Brukere</h2>
      <form onSubmit={createUser} className="flex flex-wrap gap-2 items-end mb-4">
        <div className="flex flex-col">
          <label className="text-sm mb-1">Ny bruker epost</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} className="bg-gray-800 p-2 rounded" placeholder="epost@domene.no" />
        </div>
        <div className="flex flex-col">
          <label className="text-sm mb-1">(Valgfritt) Passord</label>
          <input value={password} onChange={e=>setPassword(e.target.value)} className="bg-gray-800 p-2 rounded" placeholder="minst 8 tegn" />
        </div>
        <div className="flex flex-col">
          <label className="text-sm mb-1">Rolle</label>
          <select value={role} onChange={e=>setRole(e.target.value as any)} className="bg-gray-800 p-2 rounded">
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>
        <button disabled={creating} className="bg-brand-500 hover:bg-brand-500/80 disabled:opacity-50 px-4 py-2 rounded text-sm">{creating? 'Oppretter...':'Opprett'}</button>
        {msg && <span className="text-sm text-gray-300">{msg}</span>}
      </form>
      <div className="overflow-auto border border-gray-700 rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-800">
            <tr>
              <th className="p-2 text-left">Epost</th>
              <th className="p-2 text-left">Rolle</th>
              <th className="p-2 text-left">Opprettet</th>
              <th className="p-2 text-left">Handling</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-t border-gray-800">
                <td className="p-2">{u.email}</td>
                <td className="p-2">{u.role}</td>
                <td className="p-2">{new Date(u.createdAt).toLocaleDateString('no-NO')}</td>
                <td className="p-2">
                  <button
                    onClick={async ()=>{
                      if(!confirm(`Slette bruker ${u.email}?`)) return;
                      const r = await fetch(`/api/users?id=${u.id}`, { method:'DELETE' });
                      if(r.ok){ load(); }
                      else {
                        const d = await r.json().catch(()=>({message:'Feil'}));
                        alert(d.message||'Feil ved sletting');
                      }
                    }}
                    className="text-red-400 hover:text-red-300 text-xs underline"
                  >Slett</button>
                </td>
              </tr>
            ))}
            {!users.length && <tr><td className="p-2" colSpan={4}>Ingen brukere</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
// PasswordChange removed (moved to /password page)
