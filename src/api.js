// Base URL of your Cloudflare Worker, set in Vercel as VITE_API_URL
// e.g. https://staches-api.yourname.workers.dev
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'

async function request(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Something went wrong')
  return data
}

export const api = {
  register: (email, password) =>
    request('/api/register', { method: 'POST', body: { email, password } }),
  login: (email, password) =>
    request('/api/login', { method: 'POST', body: { email, password } }),

  getGroups: (token) => request('/api/groups', { token }),
  createGroup: (token, name, color) =>
    request('/api/groups', { method: 'POST', token, body: { name, color } }),
  deleteGroup: (token, id) =>
    request(`/api/groups/${id}`, { method: 'DELETE', token }),

  getLinks: (token, { groupId, search } = {}) => {
    const params = new URLSearchParams()
    if (groupId) params.set('groupId', groupId)
    if (search) params.set('search', search)
    const qs = params.toString()
    return request(`/api/links${qs ? `?${qs}` : ''}`, { token })
  },
  createLink: (token, link) =>
    request('/api/links', { method: 'POST', token, body: link }),
  updateLink: (token, id, link) =>
    request(`/api/links/${id}`, { method: 'PUT', token, body: link }),
  deleteLink: (token, id) =>
    request(`/api/links/${id}`, { method: 'DELETE', token })
}
