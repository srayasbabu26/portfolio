import crypto from 'node:crypto';
import { del } from '@vercel/blob';
import {
  json,
  isAuthenticated,
  SEEDS,
  ALLOWED_TYPES,
  MAX_BYTES,
  getWorksManifest,
  saveWorksManifest,
  createHandler
} from './_lib.js';

export default createHandler(async function handler(request) {
  const url = new URL(request.url);

  // 1. GET /api/works — List all works
  if (request.method === 'GET') {
    try {
      const { works, hidden } = await getWorksManifest();
      const hiddenIds = new Set(hidden);

      const activeSeeds = SEEDS.filter(s => !hiddenIds.has(s.id));
      const activeWorks = works.filter(w => !hiddenIds.has(w.id));

      const all = [...activeWorks, ...activeSeeds].sort((a, b) =>
        (b.createdAt || '').localeCompare(a.createdAt || '')
      );

      return json({ works: all });
    } catch (err) {
      console.error('Failed to load works:', err);
      return json({ error: 'Could not load works collection.' }, 500);
    }
  }

  // 2. POST /api/works — Save new work metadata
  if (request.method === 'POST') {
    if (!isAuthenticated(request)) {
      return json({ error: 'Only the portfolio owner can add work.' }, 403);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: 'Invalid JSON payload.' }, 400);
    }

    const { title, description = '', category, type, size, url: mediaUrl } = payload || {};

    if (!title || typeof title !== 'string' || title.trim().length === 0 || title.length > 100) {
      return json({ error: 'Title is required (max 100 characters).' }, 400);
    }

    if (!['design', 'photo', 'video'].includes(category)) {
      return json({ error: 'Category must be design, photo, or video.' }, 400);
    }

    if (!ALLOWED_TYPES.has(type) || type.startsWith('video/') !== (category === 'video')) {
      return json({ error: 'File type does not match chosen category.' }, 400);
    }

    if (!mediaUrl || typeof mediaUrl !== 'string') {
      return json({ error: 'Media URL is missing.' }, 400);
    }

    const id = crypto.randomUUID();
    const newWork = {
      id,
      title: title.trim(),
      description: (description || '').trim().slice(0, 500),
      category,
      type,
      size: Number(size) || 0,
      url: mediaUrl,
      createdAt: new Date().toISOString()
    };

    try {
      const { works, hidden } = await getWorksManifest();
      works.unshift(newWork);
      await saveWorksManifest(works, hidden);

      return json({ work: newWork }, 201);
    } catch (err) {
      console.error('Failed to save work:', err);
      return json({ error: 'Failed to save work to portfolio.' }, 500);
    }
  }

  // 3. DELETE /api/works?id=... — Delete or hide work
  if (request.method === 'DELETE') {
    if (!isAuthenticated(request)) {
      return json({ error: 'Only the portfolio owner can remove work.' }, 403);
    }

    const id = url.searchParams.get('id');
    if (!id) {
      return json({ error: 'Work ID is required.' }, 400);
    }

    try {
      const { works, hidden } = await getWorksManifest();
      const hiddenSet = new Set(hidden);

      // Check if it's a seed item
      if (SEEDS.some(s => s.id === id)) {
        hiddenSet.add(id);
        await saveWorksManifest(works, Array.from(hiddenSet));
        return json({ ok: true });
      }

      // Check if it's an uploaded item
      const itemToDelete = works.find(w => w.id === id);
      if (itemToDelete) {
        const remaining = works.filter(w => w.id !== id);
        await saveWorksManifest(remaining, Array.from(hiddenSet));

        // Attempt to delete blob file if stored in Vercel Blob
        if (process.env.BLOB_READ_WRITE_TOKEN && itemToDelete.url.includes('.blob.vercel-storage.com')) {
          try {
            await del(itemToDelete.url);
          } catch (delErr) {
            console.warn('Could not delete blob asset:', delErr);
          }
        }

        return json({ ok: true });
      }

      return json({ error: 'Work not found.' }, 404);
    } catch (err) {
      console.error('Failed to delete work:', err);
      return json({ error: 'Failed to delete work.' }, 500);
    }
  }

  return json({ error: 'Method not allowed.' }, 405);
});
