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

  const baseBox: React.CSSProperties = {
    width: '52px',
    height: '64px',
    borderRadius: '14px',
    borderWidth: '1.5px',
    borderStyle: 'solid',
    background: 'rgba(30, 41, 59, 0.55)',
    color: '#ffffff',
    fontSize: '1.5rem',
    fontWeight: 500,
    textAlign: 'center',
    outline: 'none',
    caretColor: '#60a5fa',
    transition: 'all 0.2s ease',
    backdropFilter: 'blur(8px)',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
      {Array.from({ length }).map((_, index) => {
        const isFilled = !!digits[index]
        const isFocused = focusedIndex === index

        let borderColor = 'rgba(71, 85, 105, 0.35)'
        let boxShadow = 'none'

        if (error) {
          borderColor = 'rgba(239, 68, 68, 0.6)'
          boxShadow = '0 0 18px rgba(239, 68, 68, 0.35)'
        } else if (isFocused) {
          borderColor = 'rgba(96, 165, 250, 0.7)'
          boxShadow = '0 0 22px rgba(96, 165, 250, 0.45)'
        } else if (isFilled) {
          borderColor = 'rgba(100, 116, 139, 0.45)'
        }

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
            style={{ ...baseBox, borderColor, boxShadow }}
          />
        )
      })}
    </div>
  )
}

function LockIcon() {
  return (
    <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 20px' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: 'rgba(59, 130, 246, 0.12)',
          filter: 'blur(24px)',
        }}
      />
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.2}
        style={{
          position: 'relative',
          width: '44px',
          height: '44px',
          color: '#e2e8f0',
          filter: 'drop-shadow(0 0 10px rgba(148,163,184,0.45))',
          margin: '18px',
        }}
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

  const cardStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    maxWidth: '380px',
    borderRadius: '24px',
    padding: '40px 32px',
    background: 'rgba(15, 23, 42, 0.65)',
    border: '1px solid rgba(100, 116, 139, 0.18)',
    boxShadow: '0 25px 80px rgba(0,0,0,0.55)',
    backdropFilter: 'blur(20px)',
  }

  const beforeStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: '24px',
    background: 'linear-gradient(to bottom, rgba(255,255,255,0.06), transparent)',
    pointerEvents: 'none',
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: '#0a0c14',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {/* ambient glows */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '25%',
          width: '400px',
          height: '400px',
          transform: 'translateX(-50%)',
          borderRadius: '50%',
          background: 'rgba(37, 99, 235, 0.1)',
          filter: 'blur(120px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: '25%',
          bottom: '25%',
          width: '320px',
          height: '320px',
          borderRadius: '50%',
          background: 'rgba(79, 70, 229, 0.09)',
          filter: 'blur(100px)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          ...cardStyle,
          animation: shake ? 'shake 0.45s ease-in-out' : undefined,
        }}
      >
        <div style={beforeStyle} />
        <div style={{ position: 'relative', textAlign: 'center' }}>
          <LockIcon />

          <h1
            style={{
              fontSize: '1.6rem',
              fontWeight: 600,
              color: '#f8fafc',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Admin Access
          </h1>
          <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '8px' }}>
            Enter the {EXPECTED.length}-digit PIN to unlock the dashboard
          </p>

          <div style={{ marginTop: '32px' }}>
            <PinInput length={EXPECTED.length} value={pin} onChange={setPin} error={error} />
          </div>

          {error && (
            <p
              style={{
                marginTop: '18px',
                fontSize: '0.85rem',
                fontWeight: 500,
                color: '#f87171',
              }}
            >
              Incorrect PIN. Try again.
            </p>
          )}

          <p style={{ marginTop: '24px', fontSize: '0.75rem', color: '#64748b' }}>
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
      `}</style>
    </div>
  )
}
