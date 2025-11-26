'use client'

import dynamic from 'next/dynamic'
const SignalCard = dynamic(()=>import('../../components/SignalCard'),{ ssr:false })
const VNIndexChartWidget = dynamic(()=>import('../../components/market/VNIndexChartWidget'),{ ssr:false })
const VNIndicesWidget = dynamic(()=>import('../../components/market/VNIndicesWidget'),{ ssr:false })
const VNIndexEvaluationWidget = dynamic(()=>import('../../components/market/VNIndexEvaluationWidget'),{ ssr:false })

export default function DashboardPage(){
  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-5 w-full max-w-full overflow-x-hidden">
      <VNIndicesWidget />
      <VNIndexEvaluationWidget />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-5 w-full">
        <VNIndexChartWidget />
        <SignalCard />
      </div>
    </div>
  )
}
