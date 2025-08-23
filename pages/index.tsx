import { useState } from 'react';
import { useRouter } from 'next/router';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (res.ok) {
      router.push('/dashboard');
    } else {
      const data = await res.json().catch(()=>({message:'Feil'}));
      setError(data.message || 'Feil ved innlogging');
    }
  }

  return (
    <div className="flex items-center justify-center py-20">
      <form onSubmit={submit} className="bg-gray-800 p-8 rounded w-full max-w-md space-y-4 shadow">
        <h1 className="text-2xl font-semibold text-center">HOLSHIP RMS</h1>
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <div>
          <label className="block text-sm mb-1">Epost</label>
          <input className="w-full p-2 rounded bg-gray-900 border border-gray-700" value={email} onChange={e=>setEmail(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Passord</label>
          <input type="password" className="w-full p-2 rounded bg-gray-900 border border-gray-700" value={password} onChange={e=>setPassword(e.target.value)} />
        </div>
        <button className="w-full bg-brand-500 hover:bg-brand-500/80 text-white rounded py-2">Logg inn</button>
      </form>
    </div>
  );
}
