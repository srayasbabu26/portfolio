import test from 'node:test';
import assert from 'node:assert/strict';
import sessionHandler from '../api/session.js';
import loginHandler from '../api/login.js';
import logoutHandler from '../api/logout.js';
import worksHandler from '../api/works.js';
import worksIdHandler from '../api/works/[id].js';
import { createAuthToken, ADMIN_PASSWORD } from '../api/_lib.js';

const origin = 'https://portfolio.test';

test('Vercel API: public visitor session is unauthenticated', async () => {
  const req = new Request(`${origin}/api/session`, { method: 'GET' });
  const res = await sessionHandler(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.canManage, false);
});

test('Vercel API: login rejects wrong password', async () => {
  const req = new Request(`${origin}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'wrong-password' })
  });
  const res = await loginHandler(req);
  assert.equal(res.status, 401);
});

test('Vercel API: login succeeds with correct password and sets cookie', async () => {
  const req = new Request(`${origin}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD })
  });
  const res = await loginHandler(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.canManage, true);
  const setCookie = res.headers.get('set-cookie');
  assert.ok(setCookie.includes('portfolio_auth='));
});

test('Vercel API: authenticated session check succeeds with valid cookie', async () => {
  const token = createAuthToken(ADMIN_PASSWORD);
  const req = new Request(`${origin}/api/session`, {
    method: 'GET',
    headers: { 'cookie': `portfolio_auth=${token}` }
  });
  const res = await sessionHandler(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.canManage, true);
});

test('Vercel API: logout clears cookie', async () => {
  const req = new Request(`${origin}/api/logout`, { method: 'POST' });
  const res = await logoutHandler(req);
  assert.equal(res.status, 200);
  const setCookie = res.headers.get('set-cookie');
  assert.ok(setCookie.includes('Max-Age=0'));
});

test('Vercel API: public works list returns seed items', async () => {
  const req = new Request(`${origin}/api/works`, { method: 'GET' });
  const res = await worksHandler(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.works));
  assert.ok(data.works.length >= 2);
  assert.equal(data.works[0].id, 'seed-silvia');
});

test('Vercel API: adding work requires authentication', async () => {
  const req = new Request(`${origin}/api/works`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Test piece',
      category: 'design',
      type: 'image/jpeg',
      url: 'https://example.com/test.jpg'
    })
  });
  const res = await worksHandler(req);
  assert.equal(res.status, 403);
});

test('Vercel API: authenticated owner can add work and delete it', async () => {
  const token = createAuthToken(ADMIN_PASSWORD);
  const authHeaders = {
    'Content-Type': 'application/json',
    'cookie': `portfolio_auth=${token}`
  };

  // Add work
  const addReq = new Request(`${origin}/api/works`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: 'Automotive Render',
      description: 'CGI render of concept car',
      category: 'design',
      type: 'image/jpeg',
      size: 1024,
      url: 'https://fake-blob.vercel-storage.com/works/render.jpg'
    })
  });
  const addRes = await worksHandler(addReq);
  assert.equal(addRes.status, 201);
  const { work } = await addRes.json();
  assert.equal(work.title, 'Automotive Render');

  // Verify it appears in GET
  const listReq = new Request(`${origin}/api/works`, { method: 'GET' });
  const listRes = await worksHandler(listReq);
  const { works } = await listRes.json();
  assert.ok(works.some(w => w.id === work.id));

  // Delete via /api/works/:id
  const delReq = new Request(`${origin}/api/works/${work.id}`, {
    method: 'DELETE',
    headers: authHeaders
  });
  const delRes = await worksIdHandler(delReq);
  assert.equal(delRes.status, 200);

  // Verify removed
  const listAfter = await (await worksHandler(listReq)).json();
  assert.ok(!listAfter.works.some(w => w.id === work.id));
});
