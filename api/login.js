import { json, ADMIN_PASSWORD, createAuthToken } from './_lib.js';

export default async function handler(request) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { password } = body || {};
  if (!password || password !== ADMIN_PASSWORD) {
    return json({ error: 'Incorrect password. Please try again.' }, 401);
  }

  const token = createAuthToken(ADMIN_PASSWORD);
  // Set HttpOnly, SameSite=Lax cookie valid for 30 days
  const isSecure = request.headers.get('x-forwarded-proto') === 'https';
  const cookieFlags = ['Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=2592000'];
  if (isSecure) cookieFlags.push('Secure');

  return json(
    { ok: true, canManage: true },
    200,
    { 'Set-Cookie': `portfolio_auth=${token}; ${cookieFlags.join('; ')}` }
  );
}
