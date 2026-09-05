import { useEffect, useRef, useState } from 'react'

const EXPECTED = (import.meta.env.VITE_ADMIN_PASSWORD as string | undefined) ?? '0000'
const STORAGE_KEY = 'newslens_admin_auth'

export function isAdminAuthenticated(): boolean {
  return sessionStorage.getItem(STORAGE_KEY) === '1'
}

function PinInput({
  length,
  value,
  onChange,
  disabled,
  error,
}: {
  length: number
  value: string
  onChange: (pin: string) => void
  disabled?: boolean
  error?: boolean
}) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])
  const [focusedIndex, setFocusedIndex] = useState(0)

  const digits = value.padEnd(length, '').split('')

  useEffect(() => {
    inputsRef.current[focusedIndex]?.focus()
  }, [focusedIndex])

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[index]) {
        const next = value.slice(0, index) + value.slice(index + 1)
        onChange(next)
        setFocusedIndex(index)
      } else if (index > 0) {
        const next = value.slice(0, index - 1) + value.slice(index)
        onChange(next)
        setFocusedIndex(index - 1)
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      setFocusedIndex(index - 1)
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault()
      setFocusedIndex(index + 1)
    }
  }

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const char = e.target.value.slice(-1)
    if (!/^\d$/.test(char)) return

    const next = value.slice(0, index) + char + value.slice(index + 1)
    onChange(next)

    if (index < length - 1) {
      setFocusedIndex(index + 1)
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (pasted) {
      onChange(pasted)
      setFocusedIndex(Math.min(pasted.length, length - 1))
    }
  }

  return (
    <div className="flex items-center justify-center gap-3">
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => { inputsRef.current[index] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[index] ?? ''}
          disabled={disabled}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={() => setFocusedIndex(index)}
          className={[
            'w-14 h-16 text-center text-2xl font-semibold rounded-xl border-2 outline-none transition-all',
            'bg-white text-gray-900 placeholder-transparent',
            error
              ? 'border-red-400 bg-red-50 focus:border-red-500'
              : 'border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100',
          ].join(' ')}
        />
      ))}
    </div>
  )
}

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(isAdminAuthenticated())
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  useEffect(() => {
    if (pin.length === EXPECTED.length) {
      if (pin === EXPECTED) {
        sessionStorage.setItem(STORAGE_KEY, '1')
        setAuthenticated(true)
        setError(false)
      } else {
        setError(true)
        setShake(true)
        setPin('')
        setTimeout(() => setShake(false), 400)
      }
    }
  }, [pin])

  if (authenticated) {
    return <>{children}</>
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div
        className={[
          'w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl transition-transform',
          shake ? 'animate-shake' : '',
        ].join(' ')}
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-7 w-7 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">NewsLens Admin</h1>
          <p className="mt-2 text-sm text-gray-500">
            Enter the {EXPECTED.length}-digit admin PIN to continue
          </p>
        </div>

        <PinInput
          length={EXPECTED.length}
          value={pin}
          onChange={setPin}
          error={error}
        />

        {error && (
          <p className="mt-4 text-center text-sm font-medium text-red-600">
            Incorrect PIN. Please try again.
          </p>
        )}

        <p className="mt-6 text-center text-xs text-gray-400">
          This area is restricted to event organizers.
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  )
}
