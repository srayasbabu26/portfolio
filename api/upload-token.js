import crypto from 'node:crypto';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import { json, isAuthenticated, ALLOWED_TYPES, MAX_BYTES, createHandler } from './_lib.js';

export default createHandler(async function handler(request) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (!isAuthenticated(request)) {
    return json({ error: 'Only the portfolio owner can upload work.' }, 403);
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return json({
      error: 'Vercel Blob storage is not connected yet. In your Vercel Dashboard, go to Storage -> Create Blob Database, then redeploy.'
    }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { filename, contentType } = body || {};
  if (!filename || !contentType || !ALLOWED_TYPES.has(contentType)) {
    return json({ error: 'Unsupported file type. Choose JPG, PNG, WebP, GIF, MP4, WebM, or MOV.' }, 415);
  }

  const ext = filename.split('.').pop().toLowerCase();
  const safeBase = filename.slice(0, 30).replace(/[^a-zA-Z0-9_-]/g, '_');
  const pathname = `works/${crypto.randomUUID()}-${safeBase}.${ext}`;

  try {
    const clientToken = await generateClientTokenFromReadWriteToken({
      pathname,
      allowedContentTypes: Array.from(ALLOWED_TYPES),
      maximumSizeInBytes: MAX_BYTES,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });

    return json({ clientToken, pathname });
  } catch (err) {
    console.error('Failed to generate client upload token:', err);
    return json({ error: 'Could not prepare upload. Please try again.' }, 500);
  }
});
