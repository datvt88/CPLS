'use client'

export default function SimpleCommoditiesWidget() {
  const commodities = [
    { name: 'Vàng', icon: '🥇', price: 1945.50, change: 12.30, pct: 0.64, unit: 'USD/oz' },
    { name: 'Dầu Brent', icon: '🛢️', price: 85.67, change: -1.25, pct: -1.44, unit: 'USD/barrel' },
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
      <h3 className="text-xl font-bold mb-6 text-white">🛢️ Hàng hóa</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {commodities.map((commodity) => (
          <div
            key={commodity.name}
            className="bg-gray-800/50 rounded-lg p-4 hover:bg-gray-800/70 transition-all border border-gray-700"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{commodity.icon}</span>
              <div>
                <div className="font-semibold text-white">{commodity.name}</div>
                <div className="text-xs text-gray-400">{commodity.unit}</div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-2xl font-bold text-white">
                ${commodity.price.toFixed(2)}
              </div>
              <div className={`text-sm font-semibold ${getPriceColor(commodity.change)}`}>
                {getIcon(commodity.change)} {commodity.change > 0 ? '+' : ''}${commodity.change.toFixed(2)} ({commodity.pct > 0 ? '+' : ''}{commodity.pct.toFixed(2)}%)
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
