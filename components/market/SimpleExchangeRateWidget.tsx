'use client'

export default function SimpleExchangeRateWidget() {
  const rates = [
    { name: 'Đô la Mỹ', flag: '🇺🇸', code: 'USD', buy: 23450, sell: 23850 },
    { name: 'Euro', flag: '🇪🇺', code: 'EUR', buy: 25300, sell: 25800 },
    { name: 'Yên Nhật', flag: '🇯🇵', code: 'JPY', buy: 165, sell: 175 },
    { name: 'Bảng Anh', flag: '🇬🇧', code: 'GBP', buy: 28900, sell: 29500 },
  ]

  const formatVND = (value: number) => {
    return value.toLocaleString('vi-VN')
  }

  return (
    <div className="bg-[--panel] rounded-xl p-6 border border-gray-800">
      <h3 className="text-xl font-bold mb-6 text-white">
        💱 Tỷ giá ngoại tệ <span className="text-sm font-normal text-gray-400">vs VND 🇻🇳</span>
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rates.map((rate) => {
          const spread = rate.sell - rate.buy
          const spreadPct = (spread / rate.buy) * 100

          return (
            <div
              key={rate.code}
              className="bg-gray-800/50 rounded-lg p-4 hover:bg-gray-800/70 transition-all border border-gray-700"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{rate.flag}</span>
                <div>
                  <div className="font-semibold text-white text-lg">{rate.name}</div>
                  <div className="text-xs text-gray-400">{rate.code}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-900/20 rounded-lg p-3 border border-green-700/30">
                  <div className="text-xs text-green-400 mb-1">Mua vào</div>
                  <div className="text-lg font-bold text-green-500">{formatVND(rate.buy)}</div>
                </div>

                <div className="bg-red-900/20 rounded-lg p-3 border border-red-700/30">
                  <div className="text-xs text-red-400 mb-1">Bán ra</div>
                  <div className="text-lg font-bold text-red-500">{formatVND(rate.sell)}</div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-700 flex justify-between text-xs">
                <div className="text-gray-400">
                  Chênh lệch: <span className="text-yellow-400 font-semibold">{formatVND(spread)}</span>
                </div>
                <div className="text-gray-400">({spreadPct.toFixed(2)}%)</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
