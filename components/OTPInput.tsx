'use client'

import { useRef, useEffect, KeyboardEvent, ClipboardEvent } from 'react'

interface OTPInputProps {
  value: string // 6-digit string
  onChange: (value: string) => void
  onComplete?: (otp: string) => void
  disabled?: boolean
  error?: string
  autoFocus?: boolean
}

/**
 * 6-digit OTP input component with auto-focus and auto-submit
 */
export default function OTPInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  error,
  autoFocus = true,
}: OTPInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Auto-focus first input on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus()
    }
  }, [autoFocus])

  // Auto-submit when all 6 digits are entered
  useEffect(() => {
    if (value.length === 6 && onComplete) {
      onComplete(value)
    }
  }, [value, onComplete])

  // Handle input change
  const handleChange = (index: number, digit: string) => {
    // Only allow digits
    if (digit && !/^\d$/.test(digit)) return

    const newValue = value.split('')
    newValue[index] = digit
    const newOTP = newValue.join('')

    onChange(newOTP)

    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  // Handle backspace
  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!value[index] && index > 0) {
        // If current input is empty, focus previous and clear it
        const newValue = value.split('')
        newValue[index - 1] = ''
        onChange(newValue.join(''))
        inputRefs.current[index - 1]?.focus()
      } else {
        // Clear current input
        const newValue = value.split('')
        newValue[index] = ''
        onChange(newValue.join(''))
      }
      e.preventDefault()
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  // Handle paste
  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text/plain')
    const digits = pastedData.replace(/\D/g, '').slice(0, 6)

    if (digits) {
      onChange(digits)
      // Focus the next empty input or the last one
      const nextIndex = Math.min(digits.length, 5)
      inputRefs.current[nextIndex]?.focus()
    }
  }

  // Handle focus - select all text
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select()
  }

  return (
    <div className="w-full">
      {/* OTP input boxes */}
      <div className="flex justify-center gap-2 sm:gap-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={value[index] || ''}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={handleFocus}
            disabled={disabled}
            className={`
              w-12 h-14 sm:w-14 sm:h-16
              text-center text-2xl font-bold
              border-2 rounded-lg
              transition-all duration-200
              ${
                error
                  ? 'border-red-500 focus:border-red-600'
                  : value[index]
                    ? 'border-blue-500'
                    : 'border-gray-300 focus:border-blue-500'
              }
              ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
              focus:outline-none focus:ring-4
              ${error ? 'focus:ring-red-100' : 'focus:ring-blue-100'}
              ${value[index] ? 'scale-105' : 'scale-100'}
            `}
          />
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-4 text-center">
          <p className="text-sm text-red-600 flex items-center justify-center">
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
        </div>
      )}

      {/* Helper text */}
      {!error && (
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            Nhập mã 6 chữ số đã được gửi đến Zalo của bạn
          </p>
        </div>
      )}

      {/* Progress indicator */}
      <div className="mt-3 flex justify-center gap-1">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div
            key={index}
            className={`
              w-6 h-1 rounded-full transition-all duration-300
              ${value[index] ? 'bg-blue-500' : 'bg-gray-200'}
            `}
          />
        ))}
      </div>
    </div>
  )
}
