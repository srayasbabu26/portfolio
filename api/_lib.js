import crypto from 'node:crypto';
import { get, put, del } from '@vercel/blob';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';

export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'srayas@33';
export const MAX_BYTES = 50 * 1024 * 1024;
export const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime'
]);

export const SEEDS = [
  {
    id: 'seed-silvia',
    title: 'Nissan Silvia',
    description: 'Automotive poster design. Red, black, and a sense of motion.',
    category: 'design',
    type: 'image/jpeg',
    url: '/assets/nissan-silvia.jpeg',
    createdAt: '2026-09-29T00:00:01Z'
  },
  {
    id: 'seed-crafting',
    title: 'Hours of crafting',
    description: 'A visual exploration of time, imagination, and the creative process.',
    category: 'design',
    type: 'image/jpeg',
    url: '/assets/crafting.jpeg',
    createdAt: '2026-09-29T00:00:00Z'
  }
];

// In-memory fallback if Vercel Blob token is not configured yet
let memWorks = [];
let memHidden = new Set();

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers
    }
  });
}

export function parseCookies(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = {};
  cookieHeader.split(';').forEach(c => {
    const [k, v] = c.trim().split('=');
    if (k && v) cookies[k] = decodeURIComponent(v);
  });
  return cookies;
}

export function createAuthToken(password) {
  return crypto.createHmac('sha256', 'portfolio-secret-salt').update(password).digest('hex');
}

export function createHandler(fn) {
  return async function(req, res) {
    // If running in Vercel Node.js Serverless runtime (req, res pattern)
    if (res && typeof res.setHeader === 'function') {
      try {
        let body = req.body;
        if (typeof body === 'string' && body.trim()) {
          try { body = JSON.parse(body); } catch {}
        } else if (!body && (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE')) {
          body = await new Promise((resolve) => {
            let data = '';
            req.on('data', chunk => { data += chunk; });
            req.on('end', () => {
              try { resolve(JSON.parse(data)); } catch { resolve({}); }
            });
            req.on('error', () => resolve({}));
          });
        }

        const host = req.headers.host || 'localhost';
        const proto = req.headers['x-forwarded-proto'] || 'https';
        const urlStr = `${proto}://${host}${req.url}`;

        const requestWrapper = {
          method: req.method,
          url: urlStr,
          headers: {
            get(name) {
              const val = req.headers[name.toLowerCase()];
              return Array.isArray(val) ? val.join(', ') : (val !== undefined ? String(val) : null);
            }
          },
          async json() {
            return body || {};
          }
        };

        const response = await fn(requestWrapper);
        const status = response.status || 200;
        
        response.headers.forEach((val, key) => {
          res.setHeader(key, val);
        });

        const text = await response.text();
        res.statusCode = status;
        res.end(text);
      } catch (err) {
        console.error('API Error:', err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
      }
      return;
    }

    // Standard Web Request -> Response (Edge or unit tests)
    return fn(req);
  };
}

export function isAuthenticated(request) {
  const cookies = parseCookies(request);
  const token = cookies['portfolio_auth'];
  const expected = createAuthToken(ADMIN_PASSWORD);
  return token === expected;
}

export function getBlobToken() {
  let token = (process.env.BLOB_READ_WRITE_TOKEN || '').trim();
  if (token.startsWith('BLOB_READ_WRITE_TOKEN=')) {
    token = token.slice('BLOB_READ_WRITE_TOKEN='.length).trim();
  }
  if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
    token = token.slice(1, -1).trim();
  }
  return token || undefined;
}

export async function getWorksManifest() {
  const token = getBlobToken();
  if (!token && !process.env.BLOB_STORE_ID) {
    return { works: memWorks, hidden: Array.from(memHidden) };
  }
  try {
    const opts = token ? { access: 'public', token } : { access: 'public' };
    const [worksRes, hiddenRes] = await Promise.all([
      get('data/works.json', opts),
      get('data/hidden.json', opts)
    ]);

    let works = [];
    let hidden = [];

    if (worksRes && worksRes.statusCode === 200) {
      try {
        works = await new Response(worksRes.stream).json();
      } catch {}
    }

    if (hiddenRes && hiddenRes.statusCode === 200) {
      try {
        hidden = await new Response(hiddenRes.stream).json();
      } catch {}
    }

    return { works: Array.isArray(works) ? works : [], hidden: Array.isArray(hidden) ? hidden : [] };
  } catch (err) {
    console.error('Error fetching manifest from Vercel Blob:', err);
    return { works: memWorks, hidden: Array.from(memHidden) };
  }
}

export async function saveWorksManifest(works, hidden) {
  const token = getBlobToken();
  if (!token && !process.env.BLOB_STORE_ID) {
    if (works !== undefined) memWorks = works;
    if (hidden !== undefined) memHidden = new Set(hidden);
    return;
  }

  const tasks = [];
  const baseOpts = { access: 'public', addRandomSuffix: false, contentType: 'application/json' };
  const opts = token ? { ...baseOpts, token } : baseOpts;

  if (works !== undefined) {
    tasks.push(put('data/works.json', JSON.stringify(works), opts));
  }
  if (hidden !== undefined) {
    tasks.push(put('data/hidden.json', JSON.stringify(hidden), opts));
  }
  await Promise.all(tasks);
}
