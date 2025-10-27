'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fn = isSignUp ? supabase.auth.signUp : supabase.auth.signInWithPassword;
    const { error } = await fn({ email, password });
    if (error) setMessage(error.message);
    else setMessage(isSignUp ? 'Check your email for verification link!' : 'Logged in successfully');
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="w-full p-3 bg-zinc-800 rounded-xl focus:outline-none text-white"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full p-3 bg-zinc-800 rounded-xl focus:outline-none text-white"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          className="w-full bg-green-500 hover:bg-green-600 transition rounded-xl p-3 text-black font-semibold"
          type="submit"
        >
          {isSignUp ? 'Sign Up' : 'Log In'}
        </button>
      </form>
      <p
        onClick={() => setIsSignUp(!isSignUp)}
        className="text-sm mt-4 text-gray-400 text-center cursor-pointer"
      >
        {isSignUp ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
      </p>
      {message && <p className="text-center text-sm text-red-400 mt-3">{message}</p>}
    </div>
  );
}
