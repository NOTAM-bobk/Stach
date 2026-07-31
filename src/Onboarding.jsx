import { useState } from 'react'
import { api } from './api.js'

const SLIDES = [
  {
    mark: '01',
    title: 'Drop in a link, done',
    desc: 'Paste any URL and Staches fetches the page title for you — no folders to dig through, no bookmarks bar to lose it in.'
  },
  {
    mark: '02',
    title: 'Sort it into groups',
    desc: 'Keep reading, research, and inspiration in their own groups so nothing turns into one long junk pile.'
  },
  {
    mark: '03',
    title: 'Find it in a second',
    desc: 'Search, filter, pin your favorites, and sort by whatever\u2019s useful in the moment.'
  }
]

const alreadyOnboarded = () => localStorage.getItem('staches_onboarded') === '1'

export default function Onboarding({ onAuth }) {
  const [stage, setStage] = useState(alreadyOnboarded() ? 'auth' : 'intro')
  const [slide, setSlide] = useState(0)
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function goToAuth() {
    localStorage.setItem('staches_onboarded', '1')
    setStage('auth')
  }

  function nextSlide() {
    if (slide < SLIDES.length - 1) setSlide(slide + 1)
    else goToAuth()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const fn = mode === 'login' ? api.login : api.register
      const data = await fn(email.trim(), password)
      onAuth(data.token, email.trim())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="wordmark">Staches</div>

        {stage === 'intro' ? (
          <>
            <div className="slide" key={slide}>
              <span className="slide-mark">{SLIDES[slide].mark}</span>
              <h1>{SLIDES[slide].title}</h1>
              <p>{SLIDES[slide].desc}</p>
            </div>

            <div className="dots">
              {SLIDES.map((_, i) => (
                <span key={i} className={i === slide ? 'dot active' : 'dot'} />
              ))}
            </div>

            <div className="onboarding-actions">
              <button className="btn-ghost" onClick={goToAuth}>
                Skip
              </button>
              <button className="btn-primary" onClick={nextSlide}>
                {slide < SLIDES.length - 1 ? 'Next' : 'Get started'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="auth-title">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="auth-sub">
              {mode === 'login'
                ? 'Log in to get back to your links.'
                : 'Start saving links in under a minute.'}
            </p>

            <form onSubmit={handleSubmit} className="auth-form">
              <label>
                Email
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />
              </label>

              {error && <div className="form-error">{error}</div>}

              <button className="btn-primary btn-full" disabled={loading}>
                {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
              </button>
            </form>

            <button
              className="btn-link"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login')
                setError('')
              }}
            >
              {mode === 'login'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Log in'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
