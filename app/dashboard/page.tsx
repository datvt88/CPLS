'use client'

import dynamic from 'next/dynamic'
const SignalCard = dynamic(()=>import('../../components/SignalCard'),{ ssr:false })
const VNIndexChartWidget = dynamic(()=>import('../../components/market/VNIndexChartWidget'),{ ssr:false })
const VNIndicesWidget = dynamic(()=>import('../../components/market/VNIndicesWidget'),{ ssr:false })

export default function DashboardPage(){
  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden">
      <VNIndicesWidget />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 w-full">
        <VNIndexChartWidget />
        <SignalCard />
      </div>
    </div>
  )
}
