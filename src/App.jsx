import { useState, useEffect } from 'react'
import Onboarding from './Onboarding.jsx'
import Dashboard from './Dashboard.jsx'

export default function App() {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('staches_theme') || 'light'
    document.documentElement.setAttribute('data-theme', savedTheme)

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
    localStorage.setItem('staches_onboarded', '1')
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

  return (
    <>
      <div className="bg-fx" aria-hidden="true" />
      {token && user ? (
        <Dashboard token={token} user={user} onLogout={handleLogout} />
      ) : (
        <Onboarding onAuth={handleAuth} />
      )}
    </>
  )
}
