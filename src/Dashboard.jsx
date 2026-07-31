import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from './api.js'

const COLORS = ['#4f46e5', '#0ea5e9', '#16a34a', '#d97706', '#dc2626', '#7c3aed']

function faviconFor(url) {
  try {
    const host = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`
  } catch {
    return null
  }
}

function timeAgo(ts) {
  const diff = Date.now() - ts
  const min = 60000
  if (diff < min) return 'just now'
  if (diff < 60 * min) return `${Math.floor(diff / min)}m ago`
  if (diff < 24 * 60 * min) return `${Math.floor(diff / (60 * min))}h ago`
  const days = Math.floor(diff / (24 * 60 * min))
  if (days < 30) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

// ---- tiny inline icons (no external icon library) ----
const icon = (children, extra = {}) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...extra}>
    {children}
  </svg>
)
const IconMenu = () => icon(<><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></>)
const IconClose = () => icon(<><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>)
const IconPlus = ({ size } = {}) =>
  icon(<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>, size ? { width: size, height: size } : {})
const IconSearch = () => icon(<><circle cx="10" cy="10" r="6.5" /><line x1="15" y1="15" x2="20" y2="20" /></>)
const IconStar = ({ filled }) =>
  icon(<polygon points="12 2.5 15 9 22 9.7 16.8 14.4 18.2 21.3 12 17.7 5.8 21.3 7.2 14.4 2 9.7 9 9" fill={filled ? 'currentColor' : 'none'} />)
const IconCopy = () => icon(<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>)
const IconFolder = () => icon(<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />)
const IconLayers = () => icon(<><polygon points="12 2 2 7 12 12 22 7" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>)
const IconSun = () => icon(<><circle cx="12" cy="12" r="4" /><line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" /><line x1="4.2" y1="4.2" x2="5.6" y2="5.6" /><line x1="18.4" y1="18.4" x2="19.8" y2="19.8" /><line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" /><line x1="4.2" y1="19.8" x2="5.6" y2="18.4" /><line x1="18.4" y1="5.6" x2="19.8" y2="4.2" /></>)
const IconMoon = () => icon(<path d="M20 12.8A8.5 8.5 0 1 1 11.2 4a6.8 6.8 0 0 0 8.8 8.8z" />)

export default function Dashboard({ token, user, onLogout }) {
  const [groups, setGroups] = useState([])
  const [totalLinks, setTotalLinks] = useState(0)
  const [uncategorizedLinks, setUncategorizedLinks] = useState(0)
  const [links, setLinks] = useState([])
  const [activeGroup, setActiveGroup] = useState(null) // null = all, 'none' = uncategorized
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('newest')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('staches_theme') || 'light')

  const [showLinkModal, setShowLinkModal] = useState(false)
  const [editingLink, setEditingLink] = useState(null)
  const [showGroupModal, setShowGroupModal] = useState(false)

  const searchRef = useRef(null)

  const loadGroups = useCallback(async () => {
    try {
      const data = await api.getGroups(token)
      setGroups(data.groups || [])
      setTotalLinks(data.totalLinks || 0)
      setUncategorizedLinks(data.uncategorizedLinks || 0)
    } catch (err) {
      setError(err.message)
    }
  }, [token])

  const loadLinks = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getLinks(token, { groupId: activeGroup, search, sort })
      setLinks(data.links || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token, activeGroup, search, sort])

  useEffect(() => { loadGroups() }, [loadGroups])
  useEffect(() => {
    const t = setTimeout(loadLinks, 200) // debounce search
    return () => clearTimeout(t)
  }, [loadLinks])

  // keyboard shortcuts: "/" focuses search, "n" opens add-link
  useEffect(() => {
    function onKeyDown(e) {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      if (typing) return
      if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === 'n') {
        e.preventDefault()
        setEditingLink(null)
        setShowLinkModal(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('staches_theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  function selectGroup(id) {
    setActiveGroup(id)
    setSidebarOpen(false)
  }

  async function handleDeleteLink(id) {
    await api.deleteLink(token, id)
    setLinks(links.filter((l) => l.id !== id))
    loadGroups()
  }

  async function handleTogglePin(link) {
    setLinks(links.map((l) => (l.id === link.id ? { ...l, pinned: l.pinned ? 0 : 1 } : l)))
    try {
      await api.togglePin(token, link.id)
      loadLinks()
    } catch {
      loadLinks()
    }
  }

  async function handleCopy(link) {
    try {
      await navigator.clipboard.writeText(link.url)
      setCopiedId(link.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      /* clipboard not available — ignore */
    }
  }

  async function handleDeleteGroup(id) {
    await api.deleteGroup(token, id)
    setGroups(groups.filter((g) => g.id !== id))
    if (activeGroup === id) setActiveGroup(null)
    loadGroups()
    loadLinks()
  }

  const emptyMessage = search
    ? { title: 'No matches', body: `Nothing found for “${search}”.` }
    : { title: 'No links here yet', body: 'Save your first link and it\u2019ll show up in this list.' }

  return (
    <div className="app-shell">
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <aside className={sidebarOpen ? 'sidebar open' : 'sidebar'}>
        <div className="sidebar-top">
          <div className="wordmark small">Staches</div>
          <button className="icon-btn mobile-only" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <IconClose />
          </button>
        </div>

        <nav className="group-nav">
          <button
            className={activeGroup === null ? 'group-item active' : 'group-item'}
            onClick={() => selectGroup(null)}
          >
            <IconLayers />
            <span>All links</span>
            <span className="count-badge">{totalLinks}</span>
          </button>

          {uncategorizedLinks > 0 && (
            <button
              className={activeGroup === 'none' ? 'group-item active' : 'group-item'}
              onClick={() => selectGroup('none')}
            >
              <IconFolder />
              <span>Uncategorized</span>
              <span className="count-badge">{uncategorizedLinks}</span>
            </button>
          )}

          {groups.length > 0 && <div className="sidebar-divider" />}

          {groups.map((g) => (
            <div key={g.id} className="group-row">
              <button
                className={activeGroup === g.id ? 'group-item active' : 'group-item'}
                onClick={() => selectGroup(g.id)}
              >
                <span className="dot-color" style={{ background: g.color }} />
                <span>{g.name}</span>
                <span className="count-badge">{g.link_count}</span>
              </button>
              <button className="group-remove" title="Delete group" onClick={() => handleDeleteGroup(g.id)}>
                <IconClose />
              </button>
            </div>
          ))}
        </nav>

        <button className="btn-ghost btn-full" onClick={() => setShowGroupModal(true)}>
          <IconPlus /> New group
        </button>

        <div className="sidebar-footer">
          <div className="footer-row">
            <span className="user-email">{user.email}</span>
            <button className="icon-btn" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
              {theme === 'light' ? <IconMoon /> : <IconSun />}
            </button>
          </div>
          <button className="btn-link" onClick={onLogout}>Log out</button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <button className="icon-btn mobile-only" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <IconMenu />
          </button>

          <div className="search-wrap">
            <IconSearch />
            <input
              ref={searchRef}
              className="search-input"
              placeholder="Search your links…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd className="search-kbd">/</kbd>
          </div>

          <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="title">Title A–Z</option>
          </select>

          <button
            className="btn-primary desktop-only"
            onClick={() => { setEditingLink(null); setShowLinkModal(true) }}
          >
            <IconPlus /> Add link
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}

        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : links.length === 0 ? (
          <div className="empty-state">
            <h3>{emptyMessage.title}</h3>
            <p>{emptyMessage.body}</p>
          </div>
        ) : (
          <div className="link-grid">
            {links.map((link) => (
              <div className={link.pinned ? 'link-card pinned' : 'link-card'} key={link.id}>
                <img
                  className="favicon"
                  src={faviconFor(link.url)}
                  alt=""
                  onError={(e) => (e.target.style.visibility = 'hidden')}
                />
                <div className="link-body">
                  <a href={link.url} target="_blank" rel="noreferrer" className="link-title">
                    {link.title || link.url}
                  </a>
                  <span className="link-url">{link.url}</span>
                  <div className="link-meta">
                    {link.group_name && (
                      <span className="link-tag" style={{ borderColor: link.group_color }}>
                        {link.group_name}
                      </span>
                    )}
                    <span className="link-time">{timeAgo(link.created_at)}</span>
                  </div>
                </div>
                <div className="link-actions">
                  <button
                    className={link.pinned ? 'icon-btn active' : 'icon-btn'}
                    title={link.pinned ? 'Unpin' : 'Pin'}
                    onClick={() => handleTogglePin(link)}
                  >
                    <IconStar filled={!!link.pinned} />
                  </button>
                  <button className="icon-btn" title="Copy link" onClick={() => handleCopy(link)}>
                    {copiedId === link.id ? <span className="copied-text">✓</span> : <IconCopy />}
                  </button>
                  <button
                    className="text-action"
                    onClick={() => { setEditingLink(link); setShowLinkModal(true) }}
                  >
                    Edit
                  </button>
                  <button className="text-action danger-text" onClick={() => handleDeleteLink(link.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <button
        className="fab mobile-only"
        onClick={() => { setEditingLink(null); setShowLinkModal(true) }}
        aria-label="Add link"
      >
        <IconPlus size={24} />
      </button>

      {showLinkModal && (
        <LinkModal
          token={token}
          groups={groups}
          link={editingLink}
          onClose={() => setShowLinkModal(false)}
          onSaved={() => { setShowLinkModal(false); loadLinks(); loadGroups() }}
        />
      )}

      {showGroupModal && (
        <GroupModal
          token={token}
          onClose={() => setShowGroupModal(false)}
          onSaved={() => { setShowGroupModal(false); loadGroups() }}
        />
      )}
    </div>
  )
}

function LinkModal({ token, groups, link, onClose, onSaved }) {
  const [url, setUrl] = useState(link?.url || '')
  const [title, setTitle] = useState(link?.title || '')
  const [groupId, setGroupId] = useState(link?.group_id || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [fetchingTitle, setFetchingTitle] = useState(false)
  const titleTouched = useRef(!!link?.title)

  useEffect(() => {
    if (titleTouched.current) return
    if (!url || !/^https?:\/\/.+\..+/.test(url)) return
    const t = setTimeout(async () => {
      setFetchingTitle(true)
      try {
        const data = await api.getMetadata(token, url)
        if (!titleTouched.current && data.title) setTitle(data.title)
      } catch {
        /* silently skip — user can still type a title */
      } finally {
        setFetchingTitle(false)
      }
    }, 700)
    return () => clearTimeout(t)
  }, [url, token])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = { url: url.trim(), title: title.trim(), groupId: groupId || null }
      if (link) await api.updateLink(token, link.id, payload)
      else await api.createLink(token, payload)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{link ? 'Edit link' : 'Add a link'}</h2>
        <form onSubmit={handleSubmit}>
          <label>
            URL
            <input
              type="url"
              required
              autoFocus
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <label>
            Title {fetchingTitle && <span className="hint-text">fetching…</span>}
            <input
              placeholder="Auto-filled from the page — or type your own"
              value={title}
              onChange={(e) => { titleTouched.current = true; setTitle(e.target.value) }}
            />
          </label>
          <label>
            Group
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">No group</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </label>
          {error && <div className="form-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function GroupModal({ token, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await api.createGroup(token, name.trim(), color)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New group</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Name
            <input required autoFocus placeholder="e.g. Reading list" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Color
            <div className="color-picker">
              {COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={c === color ? 'swatch selected' : 'swatch'}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </label>
          {error && <div className="form-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Create group'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
