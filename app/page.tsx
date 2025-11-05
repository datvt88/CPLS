'use client';
import { AuthForm } from '@/components/AuthForm';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in and redirect
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        router.push('/dashboard');
      }
    };
    checkUser();

    // Listen for auth changes and redirect
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        router.push('/dashboard');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="max-w-md w-full bg-zinc-900 rounded-2xl shadow-lg p-6 border border-zinc-800">
        <h1 className="text-3xl font-bold text-center mb-6 text-green-400">Auto Trading AI</h1>
        <AuthForm />
      </div>
    </main>
  );
}
