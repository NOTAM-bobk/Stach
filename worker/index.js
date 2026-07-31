// Staches API — a single-file Cloudflare Worker.
// Bindings expected (see wrangler.toml / dashboard settings):
//   DB          -> a D1 database (run schema.sql against it once)
//   JWT_SECRET  -> any long random string, set as a secret

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization'
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  })
}

function error(message, status = 400) {
  return json({ error: message }, status)
}

// ---------- crypto helpers ----------

function bufToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  return bytes
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits'
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256
  )
  return `${bufToHex(salt)}:${bufToHex(bits)}`
}

async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':')
  const salt = hexToBuf(saltHex)
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits'
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256
  )
  return bufToHex(bits) === hashHex
}

function b64url(input) {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function b64urlDecodeToString(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) str += '='
  return atob(str)
}

async function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const enc = new TextEncoder()
  const headerPart = b64url(enc.encode(JSON.stringify(header)))
  const payloadPart = b64url(enc.encode(JSON.stringify(payload)))
  const data = `${headerPart}.${payloadPart}`
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign'
  ])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return `${data}.${b64url(sig)}`
}

async function verifyJWT(token, secret) {
  const [headerPart, payloadPart, sigPart] = token.split('.')
  if (!headerPart || !payloadPart || !sigPart) throw new Error('Malformed token')
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'verify'
  ])
  const data = `${headerPart}.${payloadPart}`
  const sigStr = b64urlDecodeToString(sigPart)
  const sigBytes = Uint8Array.from(sigStr, (c) => c.charCodeAt(0))
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(data))
  if (!valid) throw new Error('Invalid signature')
  const payload = JSON.parse(b64urlDecodeToString(payloadPart))
  if (payload.exp && Date.now() / 1000 > payload.exp) throw new Error('Token expired')
  return payload
}

async function requireUser(request, env) {
  const auth = request.headers.get('Authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) throw new Error('Missing token')
  const payload = await verifyJWT(token, env.JWT_SECRET)
  return payload.sub
}

// ---------- route handlers ----------

async function handleRegister(request, env) {
  const { email, password } = await request.json()
  if (!email || !password || password.length < 6) {
    return error('Email and a password of at least 6 characters are required')
  }
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
  if (existing) return error('An account with that email already exists', 409)

  const id = crypto.randomUUID()
  const passwordHash = await hashPassword(password)
  await env.DB.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .bind(id, email, passwordHash, Date.now())
    .run()

  const token = await signJWT({ sub: id, email, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 }, env.JWT_SECRET)
  return json({ token })
}

async function handleLogin(request, env) {
  const { email, password } = await request.json()
  if (!email || !password) return error('Email and password are required')

  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first()
  if (!user) return error('Invalid email or password', 401)

  const ok = await verifyPassword(password, user.password_hash)
  if (!ok) return error('Invalid email or password', 401)

  const token = await signJWT(
    { sub: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 },
    env.JWT_SECRET
  )
  return json({ token })
}

async function handleGetGroups(request, env, userId) {
  const { results } = await env.DB.prepare(
    'SELECT id, name, color, created_at FROM groups WHERE user_id = ? ORDER BY created_at DESC'
  )
    .bind(userId)
    .all()
  return json({ groups: results })
}

async function handleCreateGroup(request, env, userId) {
  const { name, color } = await request.json()
  if (!name) return error('Group name is required')
  const id = crypto.randomUUID()
  await env.DB.prepare('INSERT INTO groups (id, user_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, userId, name, color || '#4f46e5', Date.now())
    .run()
  return json({ id, name, color })
}

async function handleDeleteGroup(env, userId, groupId) {
  await env.DB.prepare('DELETE FROM groups WHERE id = ? AND user_id = ?').bind(groupId, userId).run()
  await env.DB.prepare('UPDATE links SET group_id = NULL WHERE group_id = ? AND user_id = ?')
    .bind(groupId, userId)
    .run()
  return json({ ok: true })
}

async function handleGetLinks(request, env, userId) {
  const url = new URL(request.url)
  const groupId = url.searchParams.get('groupId')
  const search = url.searchParams.get('search')

  let query = `SELECT links.*, groups.name as group_name, groups.color as group_color
               FROM links LEFT JOIN groups ON links.group_id = groups.id
               WHERE links.user_id = ?`
  const params = [userId]

  if (groupId) {
    query += ' AND links.group_id = ?'
    params.push(groupId)
  }
  if (search) {
    query += ' AND (links.title LIKE ? OR links.url LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }
  query += ' ORDER BY links.created_at DESC'

  const { results } = await env.DB.prepare(query)
    .bind(...params)
    .all()
  return json({ links: results })
}

async function handleCreateLink(request, env, userId) {
  const { url, title, groupId } = await request.json()
  if (!url) return error('A URL is required')
  const id = crypto.randomUUID()
  await env.DB.prepare('INSERT INTO links (id, user_id, group_id, url, title, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, userId, groupId || null, url, title || '', Date.now())
    .run()
  return json({ id })
}

async function handleUpdateLink(request, env, userId, linkId) {
  const { url, title, groupId } = await request.json()
  await env.DB.prepare('UPDATE links SET url = ?, title = ?, group_id = ? WHERE id = ? AND user_id = ?')
    .bind(url, title || '', groupId || null, linkId, userId)
    .run()
  return json({ ok: true })
}

async function handleDeleteLink(env, userId, linkId) {
  await env.DB.prepare('DELETE FROM links WHERE id = ? AND user_id = ?').bind(linkId, userId).run()
  return json({ ok: true })
}

// ---------- router ----------

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    const url = new URL(request.url)
    const path = url.pathname

    try {
      if (path === '/api/register' && request.method === 'POST') return await handleRegister(request, env)
      if (path === '/api/login' && request.method === 'POST') return await handleLogin(request, env)

      // everything below requires a valid token
      const userId = await requireUser(request, env)

      if (path === '/api/groups' && request.method === 'GET') return await handleGetGroups(request, env, userId)
      if (path === '/api/groups' && request.method === 'POST') return await handleCreateGroup(request, env, userId)

      const groupMatch = path.match(/^\/api\/groups\/([^/]+)$/)
      if (groupMatch && request.method === 'DELETE') return await handleDeleteGroup(env, userId, groupMatch[1])

      if (path === '/api/links' && request.method === 'GET') return await handleGetLinks(request, env, userId)
      if (path === '/api/links' && request.method === 'POST') return await handleCreateLink(request, env, userId)

      const linkMatch = path.match(/^\/api\/links\/([^/]+)$/)
      if (linkMatch && request.method === 'PUT') return await handleUpdateLink(request, env, userId, linkMatch[1])
      if (linkMatch && request.method === 'DELETE') return await handleDeleteLink(env, userId, linkMatch[1])

      return error('Not found', 404)
    } catch (err) {
      const status = err.message === 'Missing token' || err.message.includes('Invalid') ? 401 : 400
      return error(err.message, status)
    }
  }
}
