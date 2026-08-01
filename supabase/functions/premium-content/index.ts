import { createClient } from 'npm:@supabase/supabase-js@2.110.8';

type ProtectedContent = {
  objectPath: string;
  productCode: string;
  contentType: string;
};

const CONTENT_ALLOWLIST = new Map<string, ProtectedContent>([
  [
    'processing-proof-v1',
    {
      objectPath: 'proof/processing-proof-v1.json',
      productCode: 'fhl-premium',
      contentType: 'application/json; charset=utf-8'
    }
  ]
]);

function configuredOrigins() {
  const configured = Deno.env.get('FHL_ALLOWED_ORIGINS') || '';
  return new Set(
    configured.split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0 && value !== '*')
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

function baseHeaders(origin?: string) {
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'private, no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; sandbox",
    'Cross-Origin-Resource-Policy': 'same-site',
    'Referrer-Policy': 'no-referrer',
    'Vary': 'Origin, Authorization',
    'X-Content-Type-Options': 'nosniff'
  });
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}

function jsonResponse(origin: string | undefined, status: number, body: Record<string, unknown>) {
  const headers = baseHeaders(origin);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers });
}

function logDecision(
  requestId: string,
  status: number,
  decision: string,
  contentId?: string
) {
  console.info(JSON.stringify({
    requestId,
    status,
    decision,
    contentId: contentId || null
  }));
}

Deno.serve(async (request) => {
  const requestId = crypto.randomUUID();
  const origin = request.headers.get('origin') || '';
  const allowedOrigins = configuredOrigins();

  if (!origin || !allowedOrigins.has(origin)) {
    logDecision(requestId, 403, 'origin_denied');
    return jsonResponse(undefined, 403, {
      error: 'This request origin is not allowed.',
      requestId
    });
  }

  if (request.method === 'OPTIONS') {
    logDecision(requestId, 204, 'preflight_allowed');
    return new Response(null, { status: 204, headers: baseHeaders(origin) });
  }

  if (request.method !== 'POST') {
    logDecision(requestId, 405, 'method_denied');
    return jsonResponse(origin, 405, {
      error: 'Method not allowed.',
      requestId
    });
  }

  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    logDecision(requestId, 401, 'session_required');
    return jsonResponse(origin, 401, {
      error: 'A verified account session is required.',
      requestId
    });
  }

  const projectUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = readNamedProjectKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
  const serviceRoleKey = readNamedProjectKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
  const bucket = Deno.env.get('FHL_PREMIUM_BUCKET') || 'premium-content';

  if (!projectUrl || !publishableKey || !serviceRoleKey) {
    console.error(JSON.stringify({ requestId, error: 'required_environment_unavailable' }));
    return jsonResponse(origin, 503, {
      error: 'Protected content is temporarily unavailable.',
      requestId
    });
  }

  const userClient = createClient(projectUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } }
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    logDecision(requestId, 401, 'session_invalid');
    return jsonResponse(origin, 401, {
      error: 'The account session is invalid or expired.',
      requestId
    });
  }

  let payload: { contentId?: string } = {};
  try {
    payload = await request.json();
  } catch {
    logDecision(requestId, 400, 'invalid_json');
    return jsonResponse(origin, 400, {
      error: 'A JSON request body is required.',
      requestId
    });
  }

  const contentId = typeof payload.contentId === 'string' ? payload.contentId.trim() : '';
  const protectedContent = CONTENT_ALLOWLIST.get(contentId);
  if (!protectedContent) {
    logDecision(requestId, 404, 'content_not_found', contentId);
    return jsonResponse(origin, 404, {
      error: 'Protected content was not found.',
      requestId
    });
  }

  const adminClient = createClient(projectUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: entitled, error: entitlementError } = await adminClient.rpc(
    'has_effective_entitlement',
    {
      requested_user_id: userData.user.id,
      requested_product_code: protectedContent.productCode
    }
  );

  if (entitlementError) {
    console.error(JSON.stringify({
      requestId,
      error: 'entitlement_check_failed',
      contentId
    }));
    return jsonResponse(origin, 503, {
      error: 'Protected content is temporarily unavailable.',
      requestId
    });
  }

  if (entitled !== true) {
    logDecision(requestId, 403, 'upgrade_required', contentId);
    return jsonResponse(origin, 403, {
      error: 'An active premium entitlement is required.',
      code: 'upgrade_required',
      requestId
    });
  }

  const { data: objectData, error: objectError } = await adminClient.storage
    .from(bucket)
    .download(protectedContent.objectPath);

  if (objectError || !objectData) {
    console.error(JSON.stringify({
      requestId,
      error: 'protected_object_unavailable',
      contentId
    }));
    return jsonResponse(origin, 503, {
      error: 'Protected content is temporarily unavailable.',
      requestId
    });
  }

  const headers = baseHeaders(origin);
  headers.set('Content-Type', protectedContent.contentType);
  headers.set('X-FHL-Content-Id', contentId);
  headers.set('X-FHL-Request-Id', requestId);

  logDecision(requestId, 200, 'content_delivered', contentId);
  return new Response(objectData, { status: 200, headers });
});
