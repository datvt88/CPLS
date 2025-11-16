'use client'

import { useState, forwardRef } from 'react'

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  onEnter?: () => void
  disabled?: boolean
  error?: string
  placeholder?: string
  autoFocus?: boolean
}

/**
 * Phone number input component with Vietnam number formatting
 * Supports formats: 0901234567 or 84901234567
 */
const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      value,
      onChange,
      onEnter,
      disabled = false,
      error,
      placeholder = 'Nhập số điện thoại',
      autoFocus = false,
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false)

    // Format phone number as user types
    const formatPhoneNumber = (input: string): string => {
      // Remove all non-digits
      const digits = input.replace(/\D/g, '')

      // Limit to 11 digits (84901234567 or 0901234567)
      const limited = digits.slice(0, 11)

      // Format: 0901 234 567 or 84 901 234 567
      if (limited.startsWith('84')) {
        // International format
        if (limited.length <= 2) return limited
        if (limited.length <= 5)
          return `${limited.slice(0, 2)} ${limited.slice(2)}`
        if (limited.length <= 8)
          return `${limited.slice(0, 2)} ${limited.slice(2, 5)} ${limited.slice(5)}`
        return `${limited.slice(0, 2)} ${limited.slice(2, 5)} ${limited.slice(5, 8)} ${limited.slice(8)}`
      } else {
        // Local format (starts with 0)
        if (limited.length <= 4) return limited
        if (limited.length <= 7)
          return `${limited.slice(0, 4)} ${limited.slice(4)}`
        return `${limited.slice(0, 4)} ${limited.slice(4, 7)} ${limited.slice(7)}`
      }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatPhoneNumber(e.target.value)
      onChange(formatted)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && onEnter) {
        e.preventDefault()
        onEnter()
      }
    }

    // Get display prefix based on input
    const getPrefix = () => {
      const digits = value.replace(/\D/g, '')
      if (digits.startsWith('84')) return '+84'
      if (digits.startsWith('0') || !digits) return 'VN'
      return 'VN'
    }

    return (
      <div className="w-full">
        <div className="relative">
          {/* Country prefix indicator */}
          <div
            className={`absolute left-0 top-0 bottom-0 flex items-center pl-4 pr-2 pointer-events-none ${
              isFocused
                ? 'text-blue-600'
                : error
                  ? 'text-red-600'
                  : 'text-gray-500'
            }`}
          >
            <span className="text-sm font-medium">{getPrefix()}</span>
            <span className="ml-2 text-gray-400">|</span>
          </div>

          {/* Phone input */}
          <input
            ref={ref}
            type="tel"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={disabled}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className={`
              w-full pl-20 pr-4 py-3
              text-lg font-medium
              border-2 rounded-lg
              transition-all duration-200
              ${
                error
                  ? 'border-red-500 focus:border-red-600'
                  : isFocused
                    ? 'border-blue-500 focus:border-blue-600'
                    : 'border-gray-300 focus:border-blue-500'
              }
              ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
              focus:outline-none focus:ring-4
              ${error ? 'focus:ring-red-100' : 'focus:ring-blue-100'}
            `}
          />

          {/* Clear button */}
          {value && !disabled && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Helper text or error */}
        {(error || !isFocused) && (
          <div className="mt-2 px-1">
            {error ? (
              <p className="text-sm text-red-600 flex items-center">
                <svg
                  className="w-4 h-4 mr-1"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </p>
            ) : (
              <p className="text-xs text-gray-500">
                Ví dụ: 0901 234 567 hoặc 84 901 234 567
              </p>
            )}
          </div>
        )}

        {/* Visual feedback on focus */}
        {isFocused && !error && (
          <div className="mt-2 px-1">
            <div className="flex items-center text-xs text-blue-600">
              <div className="w-1 h-1 bg-blue-600 rounded-full mr-2 animate-pulse"></div>
              Nhập số điện thoại của bạn
            </div>
          </div>
        )}
      </div>
    )
  }
)

PhoneInput.displayName = 'PhoneInput'

export default PhoneInput
