import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function PasswordPage(){
  const router = useRouter();
  const [currentPassword,setCurrentPassword]=useState('');
  const [newPassword1,setNewPassword1]=useState('');
  const [newPassword2,setNewPassword2]=useState('');
  const [msg,setMsg]=useState('');
  const [saving,setSaving]=useState(false);

  useEffect(()=>{ fetch('/api/auth/me').then(r=>r.json()).then(d=>{ if(!d.user) router.push('/'); }); },[router]);

  async function submit(e:React.FormEvent){
    e.preventDefault();
    if(newPassword1!==newPassword2){ setMsg('Passord matcher ikke'); return; }
    setSaving(true); setMsg('');
    const r = await fetch('/api/auth/password',{ method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ currentPassword, newPassword: newPassword1 }) });
    setSaving(false);
    if(r.ok){ setMsg('Passord oppdatert'); setCurrentPassword(''); setNewPassword1(''); setNewPassword2(''); }
    else { const d = await r.json().catch(()=>({message:'Feil'})); setMsg(d.message||'Feil'); }
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <h1 className="text-xl font-semibold">Endre passord</h1>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Nåværende passord</label>
          <input type="password" required value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} className="bg-gray-800 p-2 rounded w-full" />
        </div>
        <div>
          <label className="block text-sm mb-1">Nytt passord</label>
          <input type="password" required value={newPassword1} onChange={e=>setNewPassword1(e.target.value)} className="bg-gray-800 p-2 rounded w-full" />
        </div>
        <div>
          <label className="block text-sm mb-1">Gjenta nytt passord</label>
          <input type="password" required value={newPassword2} onChange={e=>setNewPassword2(e.target.value)} className="bg-gray-800 p-2 rounded w-full" />
        </div>
        <div className="flex gap-2 items-center">
          <button disabled={saving} className="bg-brand-500 hover:bg-brand-500/80 disabled:opacity-50 px-4 py-2 rounded text-sm">{saving?'Lagrer...':'Oppdater'}</button>
          {msg && <span className="text-sm text-gray-300">{msg}</span>}
        </div>
      </form>
      <button onClick={()=>router.push('/dashboard')} className="text-xs underline text-gray-400">Tilbake til dashboard</button>
    </div>
  );
}