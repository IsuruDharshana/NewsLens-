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
  error,
}: {
  length: number
  value: string
  onChange: (pin: string) => void
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
      {Array.from({ length }).map((_, index) => {
        const isFilled = !!digits[index]
        const isFocused = focusedIndex === index
        return (
          <input
            key={index}
            ref={(el) => { inputsRef.current[index] = el }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digits[index] ?? ''}
            onChange={(e) => handleChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={() => setFocusedIndex(index)}
            className={[
              'h-14 w-12 rounded-xl border text-center text-2xl font-medium outline-none transition-all duration-200 sm:h-16 sm:w-14',
              'bg-slate-800/60 text-white placeholder-transparent',
              'backdrop-blur-sm',
              error
                ? 'border-red-500/60 shadow-[0_0_16px_rgba(239,68,68,0.35)]'
                : isFocused
                  ? 'border-blue-400/70 shadow-[0_0_20px_rgba(96,165,250,0.45)]'
                  : isFilled
                    ? 'border-slate-500/40'
                    : 'border-slate-600/30',
            ].join(' ')}
          />
        )
      })}
    </div>
  )
}

function LockIcon() {
  return (
    <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-blue-500/10 blur-2xl" />
      <div className="absolute inset-0 rounded-full bg-indigo-500/10 blur-xl" />
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        className="relative h-14 w-14 text-slate-100 drop-shadow-[0_0_12px_rgba(148,163,184,0.5)]"
        stroke="currentColor"
        strokeWidth={1.2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.5 10.5V6.75a4.5 4.5 0 00-9 0v3.75m-.75 0h10.5a.75.75 0 01.75.75v7.5a.75.75 0 01-.75.75H5.25a.75.75 0 01-.75-.75v-7.5a.75.75 0 01.75-.75z"
        />
      </svg>
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
        setTimeout(() => setShake(false), 450)
      }
    }
  }, [pin])

  if (authenticated) {
    return <>{children}</>
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#0a0c14]">
      {/* ambient glows */}
      <div className="pointer-events-none absolute left-1/2 top-1/4 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-600/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-indigo-600/10 blur-[100px]" />

      <div
        className={[
          'relative w-full max-w-sm rounded-3xl border border-slate-700/30 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-xl',
          'before:absolute before:inset-0 before:rounded-3xl before:bg-gradient-to-b before:from-white/5 before:to-transparent before:content-[""]',
          shake ? 'animate-shake' : '',
        ].join(' ')}
      >
        <div className="relative">
          <LockIcon />

          <h1 className="text-center text-2xl font-semibold tracking-tight text-white">
            Admin Access
          </h1>
          <p className="mt-2 text-center text-sm text-slate-400">
            Enter the {EXPECTED.length}-digit PIN to unlock the dashboard
          </p>

          <div className="mt-8">
            <PinInput length={EXPECTED.length} value={pin} onChange={setPin} error={error} />
          </div>

          {error && (
            <p className="mt-5 text-center text-sm font-medium text-red-400">
              Incorrect PIN. Try again.
            </p>
          )}

          <p className="mt-6 text-center text-xs text-slate-500">
            Restricted to event organizers
          </p>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-5px); }
          60% { transform: translateX(5px); }
          75% { transform: translateX(-2px); }
          90% { transform: translateX(2px); }
        }
        .animate-shake {
          animation: shake 0.45s ease-in-out;
        }
      `}</style>
    </div>
  )
}
