/**
 * Vercel serverless endpoint: /api/sync
 *
 * A deliberately small "shared database file" for the front desk, so the desk
 * computer and the owner's phone can share one dataset without a full backend.
 * The snapshot is exactly the same JSON shape as Settings → Export Full Backup.
 *
 * Storage: any Upstash Redis REST database (Vercel Marketplace "Upstash Redis",
 * or an Upstash account). No npm dependency — plain fetch.
 *
 * Required environment variables (Project → Settings → Environment Variables):
 *   KV_REST_API_URL, KV_REST_API_TOKEN            (Vercel Marketplace integration)
 *     — or — UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 *   SYNC_SECRET                                   (the shared sync key the app asks for)
 *
 * GET  /api/sync  -> { ok, version, updatedAt, updatedBy, snapshot }
 * POST /api/sync  -> { ok, version, updatedAt }  body: { baseVersion, updatedBy, snapshot }
 *                  -> 409 + { ok:false, conflict:true, version, updatedAt, snapshot }
 *                     when someone else saved after the client's baseVersion.
 */

const SNAPSHOT_KEY = 'gymtown:snapshot';

type Credentials = { url: string; token: string };

function getCredentials(): Credentials | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ''), token };
}

async function redis(commandPath: string, options: { method?: string; body?: string } = {}) {
  const credentials = getCredentials();
  if (!credentials) {
    throw new Error(
      'Cloud sync is not configured. Add KV_REST_API_URL and KV_REST_API_TOKEN in Vercel → Project → Settings → Environment Variables, then redeploy.'
    );
  }

  const response = await fetch(`${credentials.url}/${commandPath}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${credentials.token}`,
      'Content-Type': 'text/plain',
    },
    body: options.body,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Upstash Redis error (${response.status}): ${text.slice(0, 200)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return { result: text };
  }
}

async function readSnapshot(): Promise<any | null> {
  const payload = await redis(`get/${SNAPSHOT_KEY}`);
  if (!payload || typeof payload.result !== 'string' || payload.result.length === 0) return null;
  try {
    return JSON.parse(payload.result);
  } catch {
    return null;
  }
}

async function writeSnapshot(record: any): Promise<void> {
  await redis(`set/${SNAPSHOT_KEY}`, { method: 'POST', body: JSON.stringify(record) });
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  const secret = process.env.SYNC_SECRET;
  if (!secret) {
    res.status(501).json({
      ok: false,
      error:
        'SYNC_SECRET is not set on Vercel. Add it in Project → Settings → Environment Variables and redeploy.',
    });
    return;
  }

  const provided = String(req.headers['x-sync-key'] || '');
  if (provided !== secret) {
    res.status(401).json({ ok: false, error: 'Invalid sync key.' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const record = await readSnapshot();
      if (!record) {
        res.status(200).json({ ok: true, empty: true, version: 0, updatedAt: null, snapshot: null });
        return;
      }
      res.status(200).json({
        ok: true,
        empty: false,
        version: record.version || 0,
        updatedAt: record.updatedAt || null,
        updatedBy: record.updatedBy || null,
        snapshot: record.snapshot || null,
      });
      return;
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const incoming = body.snapshot;
      if (!incoming || typeof incoming !== 'object' || !incoming.database) {
        res.status(400).json({
          ok: false,
          error: 'Snapshot missing. Expected the full backup payload with a "database" table.',
        });
        return;
      }

      const current = await readSnapshot();
      const currentVersion = current?.version || 0;
      const baseVersion = Number(body.baseVersion || 0);

      if (current && baseVersion !== currentVersion) {
        res.status(409).json({
          ok: false,
          conflict: true,
          version: currentVersion,
          updatedAt: current.updatedAt || null,
          updatedBy: current.updatedBy || null,
          snapshot: current.snapshot || null,
          error: 'Someone else saved newer data. Download the cloud copy first.',
        });
        return;
      }

      const record = {
        version: currentVersion + 1,
        updatedAt: new Date().toISOString(),
        updatedBy: typeof body.updatedBy === 'string' ? body.updatedBy.slice(0, 60) : 'front desk',
        snapshot: incoming,
      };

      await writeSnapshot(record);

      res.status(200).json({ ok: true, version: record.version, updatedAt: record.updatedAt });
      return;
    }

    res.status(405).json({ ok: false, error: 'Method not allowed.' });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || 'Cloud sync failed.' });
  }
}
