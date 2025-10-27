// app/page.tsx
import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen text-center">
      <h1 className="text-3xl font-bold mb-4">Welcome to Auto Trading Web App</h1>
      <p className="mb-6 text-gray-600 max-w-md">
        Track your trading strategies, get AI-based buy/sell signals, and manage your Supabase account easily.
      </p>
      <div className="flex gap-4">
        <Link href="/pricing" className="bg-blue-600 text-white px-4 py-2 rounded">
          View Plans
        </Link>
        <Link href="/dashboard" className="bg-gray-200 px-4 py-2 rounded">
          Go to Dashboard
        </Link>
      </div>
    </main>
  )
}
