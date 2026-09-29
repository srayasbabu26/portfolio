import { json, isAuthenticated, MAX_BYTES } from './_lib.js';

export default async function handler(request) {
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }
  const canManage = isAuthenticated(request);
  return json({
    canManage,
    maxBytes: MAX_BYTES,
    hasBlobStorage: Boolean(process.env.BLOB_READ_WRITE_TOKEN)
  });
}
