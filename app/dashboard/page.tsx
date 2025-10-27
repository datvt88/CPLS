'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
        return;
      }
      setUser(user);
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(data);
    })();
  }, []);

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-3xl mx-auto bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
        <h1 className="text-2xl font-bold mb-4 text-green-400">Welcome, {profile?.email}</h1>
        <p className="text-gray-400 mb-6">Your Plan: <span className="text-green-300">{profile?.plan}</span></p>

        <div className="bg-zinc-800 p-4 rounded-xl">
          <h2 className="text-xl mb-3 text-green-400">AI Trading Signals</h2>
          <p className="text-sm text-gray-300">📈 VNINDEX: BUY</p>
          <p className="text-sm text-gray-300">💹 HPG: STRONG BUY</p>
          <p className="text-sm text-gray-300">📉 VNM: SELL</p>
        </div>
      </div>
    </main>
  );
}
