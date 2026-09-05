import { useState } from 'react'

const EXPECTED = (import.meta.env.VITE_ADMIN_PASSWORD as string | undefined) ?? '0000'
const STORAGE_KEY = 'newslens_admin_auth'

export function isAdminAuthenticated(): boolean {
  return sessionStorage.getItem(STORAGE_KEY) === '1'
}

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(isAdminAuthenticated())
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  if (authenticated) {
    return <>{children}</>
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input === EXPECTED) {
      sessionStorage.setItem(STORAGE_KEY, '1')
      setAuthenticated(true)
      setError(false)
    } else {
      setError(true)
      setInput('')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-xl shadow-lg p-8 space-y-6"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">NewsLens Admin</h1>
          <p className="text-sm text-gray-500 mt-1">Enter the admin password to continue</p>
        </div>

        <div>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Password"
            autoFocus
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
          />
          {error && (
            <p className="text-red-600 text-sm mt-2">Incorrect password. Try again.</p>
          )}
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          Unlock Dashboard
        </button>
      </form>
    </div>
  )
}
