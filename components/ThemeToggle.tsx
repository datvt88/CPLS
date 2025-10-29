'use client'
import { useTheme } from 'next-themes'

export default function ThemeToggle(){
  const { theme, setTheme } = useTheme()
  return (
    <button onClick={()=> setTheme(theme === 'dark' ? 'light' : 'dark')} className="px-3 py-2 rounded bg-gray-800 text-sm">
      {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  )
}
