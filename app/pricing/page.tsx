'use client'
import Link from 'next/link'

export default function PricingPage() {
  const plans = [
    {
      name: 'Free',
      price: '0₫',
      features: [
        'Basic charts and watchlist',
        'Community discussions',
        'Access to learning materials'
      ]
    },
    {
      name: 'VIP',
      price: '299,000₫/month',
      features: [
        'AI-based Buy/Sell signals (DeepSeek, ChatGPT)',
        'Exclusive VIP stock filters',
        'Priority AI chat access',
        'Advanced market insights'
      ]
    }
  ]

  return (
    <main className="min-h-screen p-8 bg-white text-gray-800">
      <h1 className="text-3xl font-bold text-center mb-8">Choose Your Plan</h1>
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {plans.map((plan) => (
          <div key={plan.name} className="border rounded-2xl shadow p-6 flex flex-col">
            <h2 className="text-2xl font-semibold mb-2">{plan.name}</h2>
            <p className="text-xl font-bold text-blue-600 mb-4">{plan.price}</p>
            <ul className="flex-1 mb-4 space-y-2 list-disc list-inside">
              {plan.features.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
            <Link href="/signup" className="mt-auto bg-blue-600 text-white py-2 rounded-lg text-center">Get Started</Link>
          </div>
        ))}
      </div>
    </main>
  )
}