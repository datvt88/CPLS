'use client'
import Link from 'next/link'

export default function Sidebar(){
  const items = [
    {href:'/dashboard',label:'Tổng quan',icon:'📊'},
    {href:'/market',label:'Thị trường',icon:'🌐'},
    {href:'/stocks',label:'Cổ phiếu',icon:'💹'},
    {href:'/signals',label:'Tín hiệu',icon:'⚡'},
    {href:'/settings',label:'Cài đặt',icon:'⚙️'}
  ]
  return (
    <aside className="w-72 hidden md:block bg-[--panel] border-r border-gray-800 min-h-screen p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-md bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center font-bold">CPLS</div>
        <div>
          <div className="text-white font-semibold">CPLS</div>
          <div className="text-sm text-[--muted]">Master Trader</div>
        </div>
      </div>
      <nav className="space-y-2">
        {items.map(i => (
          <Link
            key={i.href}
            href={i.href}
            className="flex items-center py-3 px-3 rounded hover:bg-gray-800 text-gray-200 transition-colors"
          >
            <span className="text-xl">{i.icon}</span>
            <span className="ml-3">{i.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  )
}
