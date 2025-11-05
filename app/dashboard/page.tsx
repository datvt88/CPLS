'use client'

import dynamic from 'next/dynamic'
const SignalCard = dynamic(()=>import('../../components/SignalCard'),{ ssr:false })

export default function DashboardPage(){
  return (
    <div className="space-y-6">
      <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
        <h2 className="text-2xl font-semibold">Tổng quan</h2>
        <p className="text-[--muted] mt-1">Welcome to CPLS dashboard</p>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-[--panel] p-6 rounded-xl border border-gray-800">Market widgets placeholder</div>
        <SignalCard />
      </div>
    </div>
  )
}
