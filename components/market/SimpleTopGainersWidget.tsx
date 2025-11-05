'use client'

export default function SimpleTopGainersWidget() {
  const stocks = [
    { code: 'HPG', price: 28.5, change: 1.8, pct: 6.74, exchange: 'HOSE', volume: '15.50M' },
    { code: 'VNM', price: 85.2, change: 5.3, pct: 6.62, exchange: 'HOSE', volume: '8.50M' },
    { code: 'VIC', price: 42.1, change: 2.5, pct: 6.31, exchange: 'HOSE', volume: '12.20M' },
    { code: 'VHM', price: 55.8, change: 3.2, pct: 6.08, exchange: 'HOSE', volume: '9.80M' },
    { code: 'GAS', price: 78.5, change: 4.1, pct: 5.51, exchange: 'HOSE', volume: '5.30M' },
  ]

  return (
    <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
      <h3 className="text-xl font-bold mb-4 text-white">🚀 Top cổ phiếu tăng giá</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-2 text-gray-400">#</th>
              <th className="text-left py-3 px-2 text-gray-400">Mã</th>
              <th className="text-center py-3 px-2 text-gray-400">Sàn</th>
              <th className="text-right py-3 px-2 text-gray-400">Giá</th>
              <th className="text-right py-3 px-2 text-gray-400">%</th>
              <th className="text-right py-3 px-2 text-gray-400">KL</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((stock, index) => (
              <tr key={stock.code} className="border-b border-gray-800 hover:bg-gray-800/50">
                <td className="py-3 px-2 text-gray-400">#{index + 1}</td>
                <td className="py-3 px-2 font-bold text-green-500">{stock.code}</td>
                <td className="py-3 px-2 text-center">
                  <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">
                    {stock.exchange}
                  </span>
                </td>
                <td className="py-3 px-2 text-right font-semibold text-green-500">
                  {stock.price.toFixed(2)}
                </td>
                <td className="py-3 px-2 text-right font-bold text-green-500">
                  +{stock.pct.toFixed(2)}%
                </td>
                <td className="py-3 px-2 text-right text-gray-300">{stock.volume}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
