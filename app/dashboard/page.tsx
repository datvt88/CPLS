'use client'

import dynamic from 'next/dynamic'
const SignalCard = dynamic(()=>import('../../components/SignalCard'),{ ssr:false })
const VNIndexChartWidget = dynamic(()=>import('../../components/market/VNIndexChartWidget'),{ ssr:false })
const VNIndicesWidget = dynamic(()=>import('../../components/market/VNIndicesWidget'),{ ssr:false })

export default function DashboardPage(){
  return (
    <div className="space-y-6">
      <VNIndicesWidget />
      <div className="grid md:grid-cols-2 gap-6">
        <VNIndexChartWidget />
        <SignalCard />
      </div>
    </div>
  )
}
