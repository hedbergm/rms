import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import rootLogo from '../HHvitLogo.png';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);
  return (
    <div className="bg-gray-900 text-gray-100 min-h-screen flex flex-col">
      <header className="flex items-center gap-5 p-[0.9rem] border-b border-gray-800 bg-gray-950/60 backdrop-blur">
        <div className="flex items-center gap-[0.9rem]">
          <div className="relative h-[2.4rem] w-48 flex items-center">
            <Image src={typeof window!== 'undefined' ? '/HHvitLogo.png' : rootLogo} alt="Logo" fill style={{objectFit:'contain'}} sizes="160px" priority onError={(e:any)=>{ (e.target as HTMLImageElement).style.display='none'; }} />
          </div>
          <h1 className="text-[1.05rem] font-semibold tracking-wide">Ramp Management System - Holship Norway</h1>
        </div>
      </header>
      <main className="flex-1">
        <Component {...pageProps} />
      </main>
    </div>
  );
}
