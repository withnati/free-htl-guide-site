import { createClient } from 'npm:@supabase/supabase-js@2.110.8';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://withnati.github.io',
  'https://raw.githack.com',
  'http://127.0.0.1:4173',
  'http://localhost:4173'
];

function configuredOrigins() {
  const configured = Deno.env.get('FHL_ALLOWED_ORIGINS') || '';
  const values = configured.trim().length > 0
    ? configured.split(',')
    : DEFAULT_ALLOWED_ORIGINS;
  return new Set(
    values
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
  );
}

function readNamedProjectKey(mapName: string, legacyName: string) {
  const mapped = Deno.env.get(mapName);
  if (mapped) {
    try {
      const parsed = JSON.parse(mapped) as Record<string, unknown>;
      const value = parsed.default;
      if (typeof value === 'string' && value.trim().length > 0) return value;
    } catch {
      console.error(JSON.stringify({ error: 'invalid_project_key_map', mapName }));
    }
  }
  return Deno.env.get(legacyName);
}

function response(origin: string | undefined, status: number, body: Record<string, unknown> | null) {
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Vary': 'Origin, Authorization'
  });
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  if (body === null) return new Response(null, { status, headers });
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin') || '';
  const allowedOrigins = configuredOrigins();
  if (!origin || !allowedOrigins.has(origin)) {
    return response(undefined, 403, { error: 'Origin is not allowed.' });
  }
  if (request.method === 'OPTIONS') return response(origin, 204, null);
  if (request.method !== 'POST') return response(origin, 405, { error: 'Method not allowed.' });

  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    return response(origin, 401, { error: 'A verified account session is required.' });
  }

  let payload: { confirm?: string } = {};
  try {
    payload = await request.json();
  } catch {
    return response(origin, 400, { error: 'A JSON confirmation body is required.' });
  }
  if (payload.confirm !== 'DELETE MY ACCOUNT') {
    return response(origin, 400, { error: 'Account deletion was not confirmed.' });
  }

  const projectUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = readNamedProjectKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
  const serviceRoleKey = readNamedProjectKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
  if (!projectUrl || !publishableKey || !serviceRoleKey) {
    console.error('Required Supabase function environment variables are unavailable.');
    return response(origin, 503, { error: 'Account deletion is temporarily unavailable.' });
  }

  const userClient = createClient(projectUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } }
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return response(origin, 401, { error: 'The account session is invalid or expired.' });
  }

  const adminClient = createClient(projectUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { error: deletionError } = await adminClient.auth.admin.deleteUser(userData.user.id);
  if (deletionError) {
    console.error('Account deletion failed.', deletionError);
    return response(origin, 500, { error: 'The account could not be deleted.' });
  }

  return response(origin, 200, { deleted: true });
});
