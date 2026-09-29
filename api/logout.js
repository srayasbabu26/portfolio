import { json, createHandler } from './_lib.js';

export default createHandler(async function handler(request) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  return json(
    { ok: true, canManage: false },
    200,
    { 'Set-Cookie': 'portfolio_auth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' }
  );
});
