import { useState, useEffect, useCallback } from 'react'
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

export default function Dashboard({ token, user, onLogout }) {
  const [groups, setGroups] = useState([])
  const [links, setLinks] = useState([])
  const [activeGroup, setActiveGroup] = useState(null) // null = all
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showLinkModal, setShowLinkModal] = useState(false)
  const [editingLink, setEditingLink] = useState(null)
  const [showGroupModal, setShowGroupModal] = useState(false)

  const loadGroups = useCallback(async () => {
    try {
      const data = await api.getGroups(token)
      setGroups(data.groups || [])
    } catch (err) {
      setError(err.message)
    }
  }, [token])

  const loadLinks = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getLinks(token, { groupId: activeGroup, search })
      setLinks(data.links || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token, activeGroup, search])

  useEffect(() => {
    loadGroups()
  }, [loadGroups])

  useEffect(() => {
    const t = setTimeout(loadLinks, 200) // debounce search
    return () => clearTimeout(t)
  }, [loadLinks])

  async function handleDeleteLink(id) {
    await api.deleteLink(token, id)
    setLinks(links.filter((l) => l.id !== id))
  }

  async function handleDeleteGroup(id) {
    await api.deleteGroup(token, id)
    setGroups(groups.filter((g) => g.id !== id))
    if (activeGroup === id) setActiveGroup(null)
    loadLinks()
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="wordmark small">Staches</div>

        <nav className="group-nav">
          <button
            className={activeGroup === null ? 'group-item active' : 'group-item'}
            onClick={() => setActiveGroup(null)}
          >
            All links
          </button>
          {groups.map((g) => (
            <div key={g.id} className="group-row">
              <button
                className={activeGroup === g.id ? 'group-item active' : 'group-item'}
                onClick={() => setActiveGroup(g.id)}
              >
                <span className="dot-color" style={{ background: g.color }} />
                {g.name}
              </button>
              <button
                className="group-remove"
                title="Delete group"
                onClick={() => handleDeleteGroup(g.id)}
              >
                ×
              </button>
            </div>
          ))}
        </nav>

        <button className="btn-ghost btn-full" onClick={() => setShowGroupModal(true)}>
          + New group
        </button>

        <div className="sidebar-footer">
          <span className="user-email">{user.email}</span>
          <button className="btn-link" onClick={onLogout}>
            Log out
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <input
            className="search-input"
            placeholder="Search your links…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            className="btn-primary"
            onClick={() => {
              setEditingLink(null)
              setShowLinkModal(true)
            }}
          >
            + Add link
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}

        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : links.length === 0 ? (
          <div className="empty-state">
            <h3>No links here yet</h3>
            <p>Save your first link and it'll show up in this list.</p>
          </div>
        ) : (
          <div className="link-grid">
            {links.map((link) => (
              <div className="link-card" key={link.id}>
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
                  {link.group_name && (
                    <span className="link-tag" style={{ borderColor: link.group_color }}>
                      {link.group_name}
                    </span>
                  )}
                </div>
                <div className="link-actions">
                  <button
                    onClick={() => {
                      setEditingLink(link)
                      setShowLinkModal(true)
                    }}
                  >
                    Edit
                  </button>
                  <button onClick={() => handleDeleteLink(link.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showLinkModal && (
        <LinkModal
          token={token}
          groups={groups}
          link={editingLink}
          onClose={() => setShowLinkModal(false)}
          onSaved={() => {
            setShowLinkModal(false)
            loadLinks()
          }}
        />
      )}

      {showGroupModal && (
        <GroupModal
          token={token}
          onClose={() => setShowGroupModal(false)}
          onSaved={() => {
            setShowGroupModal(false)
            loadGroups()
          }}
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
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <label>
            Title
            <input
              placeholder="Optional — defaults to the URL"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Group
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">No group</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          {error && <div className="form-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
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
            <input
              required
              placeholder="e.g. Reading list"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
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
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Create group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
