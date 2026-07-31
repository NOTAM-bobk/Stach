import { useState, useEffect } from 'react'
import Onboarding from './Onboarding.jsx'
import Dashboard from './Dashboard.jsx'

export default function App() {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const savedToken = localStorage.getItem('staches_token')
    const savedEmail = localStorage.getItem('staches_email')
    if (savedToken && savedEmail) {
      setToken(savedToken)
      setUser({ email: savedEmail })
    }
    setReady(true)
  }, [])

  function handleAuth(newToken, email) {
    localStorage.setItem('staches_token', newToken)
    localStorage.setItem('staches_email', email)
    setToken(newToken)
    setUser({ email })
  }

  function handleLogout() {
    localStorage.removeItem('staches_token')
    localStorage.removeItem('staches_email')
    setToken(null)
    setUser(null)
  }

  if (!ready) return null

  return token && user ? (
    <Dashboard token={token} user={user} onLogout={handleLogout} />
  ) : (
    <Onboarding onAuth={handleAuth} />
  )
}
