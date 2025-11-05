'use client'

export default function SimpleSecuritiesWidget() {
  const indices = [
    { code: 'VNINDEX', name: 'VN-Index', price: 1250.45, change: 5.23, pct: 0.42 },
    { code: 'HNX', name: 'HNX-Index', price: 235.67, change: -2.15, pct: -0.90 },
    { code: 'UPCOM', name: 'UPCOM-Index', price: 85.23, change: 0.45, pct: 0.53 },
    { code: 'VN30', name: 'VN30-Index', price: 1320.15, change: 8.50, pct: 0.65 },
  ]

  const getPriceColor = (change: number) => {
    if (change > 0) return 'text-green-500'
    if (change < 0) return 'text-red-500'
    return 'text-yellow-500'
  }

  const getIcon = (change: number) => {
    if (change > 0) return '▲'
    if (change < 0) return '▼'
    return '▬'
  }

  return (
    <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
      <h3 className="text-xl font-bold mb-4 text-white">📊 Chỉ số chứng khoán</h3>

      <div className="space-y-3">
        {indices.map((index) => (
          <div
            key={index.code}
            className="bg-gray-800/50 rounded-lg p-4 hover:bg-gray-800/70 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="font-semibold text-lg text-white">{index.name}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">{index.price.toFixed(2)}</div>
                <div className={`text-sm font-semibold ${getPriceColor(index.change)}`}>
                  {getIcon(index.change)} {index.change > 0 ? '+' : ''}{index.change.toFixed(2)} ({index.pct > 0 ? '+' : ''}{index.pct.toFixed(2)}%)
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
