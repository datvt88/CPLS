'use client'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export default function ThemeToggle(){
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    // Return a placeholder to avoid layout shift
    return (
      <button className="px-3 py-2 rounded bg-gray-300 dark:bg-gray-800 text-sm text-[--text] dark:text-white">
        ...
      </button>
    )
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="px-3 py-2 rounded bg-gray-300 dark:bg-gray-800 text-sm text-[--text] dark:text-white hover:bg-gray-400 dark:hover:bg-gray-700 transition-colors"
    >
      {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  )
}
