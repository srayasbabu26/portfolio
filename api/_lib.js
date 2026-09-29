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

export function isAuthenticated(request) {
  const cookies = parseCookies(request);
  const token = cookies['portfolio_auth'];
  const expected = createAuthToken(ADMIN_PASSWORD);
  return token === expected;
}

export async function getWorksManifest() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { works: memWorks, hidden: Array.from(memHidden) };
  }
  try {
    const [worksRes, hiddenRes] = await Promise.all([
      get('data/works.json', { access: 'public' }),
      get('data/hidden.json', { access: 'public' })
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
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    if (works !== undefined) memWorks = works;
    if (hidden !== undefined) memHidden = new Set(hidden);
    return;
  }

  const tasks = [];
  if (works !== undefined) {
    tasks.push(put('data/works.json', JSON.stringify(works), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json'
    }));
  }
  if (hidden !== undefined) {
    tasks.push(put('data/hidden.json', JSON.stringify(hidden), {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json'
    }));
  }
  await Promise.all(tasks);
}
