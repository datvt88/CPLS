'use client'

export default function SimpleWorldIndicesWidget() {
  const indices = [
    { name: 'Dow Jones', flag: '🇺🇸', price: 34567.89, change: 125.45, pct: 0.36 },
    { name: 'Nasdaq', flag: '🇺🇸', price: 13567.23, change: -45.67, pct: -0.34 },
    { name: 'Nikkei 225', flag: '🇯🇵', price: 28456.78, change: 234.56, pct: 0.83 },
    { name: 'Shanghai', flag: '🇨🇳', price: 3245.67, change: -12.34, pct: -0.38 },
    { name: 'Hang Seng', flag: '🇭🇰', price: 18234.56, change: 89.12, pct: 0.49 },
    { name: 'FTSE 100', flag: '🇬🇧', price: 7456.78, change: 23.45, pct: 0.31 },
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
      <h3 className="text-xl font-bold mb-6 text-white">🌍 Thị trường thế giới</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {indices.map((index) => (
          <div
            key={index.name}
            className="bg-gray-800/50 rounded-lg p-4 hover:bg-gray-800/70 transition-all border border-gray-700"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{index.flag}</span>
              <span className="font-semibold text-white">{index.name}</span>
            </div>

            <div className="space-y-1">
              <div className="text-2xl font-bold text-white">
                {index.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className={`text-sm font-semibold ${getPriceColor(index.change)}`}>
                {getIcon(index.change)} {index.change > 0 ? '+' : ''}{index.change.toFixed(2)} ({index.pct > 0 ? '+' : ''}{index.pct.toFixed(2)}%)
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
