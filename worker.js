/**
 * My Tasks – Cloudflare Worker sync proxy
 *
 * Forwards SQL requests from the browser app to NeonDB,
 * adding CORS headers so browsers can call it.
 *
 * Setup:
 *   1. Go to https://workers.cloudflare.com  (free account)
 *   2. Create a new Worker, paste this file's contents
 *   3. Settings → Variables → add a Secret named NEON_CONN
 *      Value: your NeonDB connection string
 *      e.g.  postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require
 *   4. Deploy — copy the Worker URL (e.g. https://my-tasks.yourname.workers.dev)
 *   5. Paste that URL into the app → Settings (⚙) → Sync URL → Save & Connect
 */

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
    }

    try {
      const { path, body } = await request.json();

      if (!path || !body) {
        return json({ error: 'Missing path or body' }, 400);
      }

      // Parse host from the stored connection string
      const connStr = env.NEON_CONN || '';
      if (!connStr) {
        return json({ error: 'NEON_CONN secret not configured on the Worker' }, 500);
      }

      const hostMatch = connStr.match(/@([^/?]+)/);
      if (!hostMatch) {
        return json({ error: 'Could not parse host from NEON_CONN' }, 500);
      }
      const host = hostMatch[1];

      const neonRes = await fetch(`https://${host}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Neon-Connection-String': connStr,
        },
        body: JSON.stringify(body),
      });

      const data = await neonRes.text();
      return new Response(data, {
        status: neonRes.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });

    } catch (e) {
      return json({ error: e.message }, 500);
    }
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}
