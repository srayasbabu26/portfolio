import { del } from '@vercel/blob';
import { json, isAuthenticated, SEEDS, getWorksManifest, saveWorksManifest } from '../_lib.js';

export default async function handler(request) {
  if (request.method !== 'DELETE') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (!isAuthenticated(request)) {
    return json({ error: 'Only the portfolio owner can remove work.' }, 403);
  }

  const url = new URL(request.url);
  // Extract id from pathname e.g. /api/works/seed-silvia
  const segments = url.pathname.split('/').filter(Boolean);
  const id = segments[segments.length - 1];

  if (!id) {
    return json({ error: 'Work ID is required.' }, 400);
  }

  try {
    const { works, hidden } = await getWorksManifest();
    const hiddenSet = new Set(hidden);

    // If seed item, hide it
    if (SEEDS.some(s => s.id === id)) {
      hiddenSet.add(id);
      await saveWorksManifest(works, Array.from(hiddenSet));
      return json({ ok: true });
    }

    // If uploaded item, remove from works list
    const itemToDelete = works.find(w => w.id === id);
    if (itemToDelete) {
      const remaining = works.filter(w => w.id !== id);
      await saveWorksManifest(remaining, Array.from(hiddenSet));

      if (process.env.BLOB_READ_WRITE_TOKEN && itemToDelete.url && itemToDelete.url.includes('.blob.vercel-storage.com')) {
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
