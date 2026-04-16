#!/usr/bin/env node
/**
 * Admin API smoke test.
 *
 * Default mode is non-destructive.
 * - Read/list/detail endpoints
 * - Auth guard checks
 * - Invalid-id mutation endpoints should return 404
 *
 * Optional destructive mode:
 *   node tests/e2e/admin-api-smoke.mjs --destructive
 * - Creates a run (if possible) and ends it
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const ADMIN_TOKEN = process.env.ADMIN_BYPASS_TOKEN ?? 'dev-bypass-local-admin';
const DESTRUCTIVE = process.argv.includes('--destructive');
const CLEANUP = DESTRUCTIVE && !process.argv.includes('--no-cleanup');
const ALLOW_DESTRUCTIVE_REMOTE = process.env.ALLOW_DESTRUCTIVE_ADMIN_SMOKE === 'true';

function logStep(label) {
  console.log(`\n[STEP] ${label}`);
}

function logPass(label, extra = '') {
  console.log(`[PASS] ${label}${extra ? `: ${extra}` : ''}`);
}

function fail(label, details) {
  console.error(`[FAIL] ${label}: ${details}`);
  process.exitCode = 1;
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {
    'content-type': 'application/json',
  };
  if (auth) headers.authorization = `Bearer ${ADMIN_TOKEN}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }

  return { res, json };
}

function expectStatus(actual, expected, label, payload = null) {
  if (actual !== expected) {
    fail(label, `expected ${expected}, got ${actual}, payload=${JSON.stringify(payload)}`);
    return false;
  }
  logPass(label, `status=${actual}`);
  return true;
}

async function main() {
  console.log('[INFO] Admin API smoke start');
  console.log(`[INFO] BASE_URL=${BASE_URL}`);
  console.log(`[INFO] MODE=${DESTRUCTIVE ? 'destructive' : 'non-destructive'}`);
  if (DESTRUCTIVE) {
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(BASE_URL);
    if (!isLocal && !ALLOW_DESTRUCTIVE_REMOTE) {
      console.error(
        '[FATAL] Refusing destructive mode on non-local BASE_URL without ALLOW_DESTRUCTIVE_ADMIN_SMOKE=true',
      );
      process.exit(1);
    }
    if (process.env.NODE_ENV === 'production' && !ALLOW_DESTRUCTIVE_REMOTE) {
      console.error(
        '[FATAL] Refusing destructive mode when NODE_ENV=production without ALLOW_DESTRUCTIVE_ADMIN_SMOKE=true',
      );
      process.exit(1);
    }
    console.log(`[INFO] CLEANUP=${CLEANUP ? 'enabled' : 'disabled'}`);
  }

  logStep('Auth guard checks');
  {
    const noAuth = await request('/api/v1/admin/routes', { auth: false });
    expectStatus(noAuth.res.status, 401, 'GET /api/v1/admin/routes without auth', noAuth.json);
  }

  logStep('Routes domain');
  let firstRoute = null;
  {
    const routesRes = await request('/api/v1/admin/routes');
    if (
      expectStatus(routesRes.res.status, 200, 'GET /api/v1/admin/routes', routesRes.json) &&
      Array.isArray(routesRes.json)
    ) {
      firstRoute = routesRes.json[0] ?? null;
      logPass('routes count', String(routesRes.json.length));
    }

    const invalidSync = await request('/api/v1/admin/routes/not-found/sync', {
      method: 'POST',
    });
    expectStatus(
      invalidSync.res.status,
      404,
      'POST /api/v1/admin/routes/not-found/sync',
      invalidSync.json,
    );

    if (firstRoute?.id) {
      const detail = await request(`/api/v1/admin/routes/${encodeURIComponent(firstRoute.id)}`);
      expectStatus(
        detail.res.status,
        200,
        `GET /api/v1/admin/routes/${firstRoute.id}`,
        detail.json,
      );

      const stops = await request(
        `/api/v1/admin/routes/${encodeURIComponent(firstRoute.id)}/stops`,
      );
      expectStatus(
        stops.res.status,
        200,
        `GET /api/v1/admin/routes/${firstRoute.id}/stops`,
        stops.json,
      );
    } else {
      console.log('[SKIP] route detail/stops test (no routes)');
    }
  }

  logStep('Schedules domain');
  let firstSchedule = null;
  {
    const schedulesRes = await request('/api/v1/admin/schedules');
    if (
      expectStatus(
        schedulesRes.res.status,
        200,
        'GET /api/v1/admin/schedules',
        schedulesRes.json,
      ) &&
      Array.isArray(schedulesRes.json)
    ) {
      firstSchedule = schedulesRes.json[0] ?? null;
      logPass('schedules count', String(schedulesRes.json.length));
    }

    if (firstSchedule?.id) {
      const detail = await request(
        `/api/v1/admin/schedules/${encodeURIComponent(firstSchedule.id)}`,
      );
      expectStatus(
        detail.res.status,
        200,
        `GET /api/v1/admin/schedules/${firstSchedule.id}`,
        detail.json,
      );
    } else {
      console.log('[SKIP] schedule detail test (no schedules)');
    }

    const invalidPublish = await request('/api/v1/admin/schedules/not-found/publish', {
      method: 'POST',
    });
    expectStatus(
      invalidPublish.res.status,
      404,
      'POST /api/v1/admin/schedules/not-found/publish',
      invalidPublish.json,
    );
  }

  logStep('Runs domain');
  {
    const runsRes = await request('/api/v1/admin/runs?status=active');
    expectStatus(runsRes.res.status, 200, 'GET /api/v1/admin/runs?status=active', runsRes.json);

    const invalidEnd = await request('/api/v1/admin/runs/not-found/end', {
      method: 'POST',
    });
    expectStatus(
      invalidEnd.res.status,
      404,
      'POST /api/v1/admin/runs/not-found/end',
      invalidEnd.json,
    );
  }

  logStep('Download token domain');
  {
    const create = await request('/api/v1/admin/download-tokens/blob', {
      method: 'POST',
      body: {
        data: 'YQ==',
        mimeType: 'text/plain',
        filename: 'admin-smoke.txt',
      },
    });
    if (expectStatus(create.res.status, 200, 'POST /api/v1/admin/download-tokens/blob', create.json)) {
      const url = create.json?.downloadUrl;
      if (typeof url === 'string') {
        const dl = await request(url, { auth: false });
        expectStatus(dl.res.status, 200, `GET ${url}`, dl.json);
      } else {
        fail('downloadUrl', `missing in response: ${JSON.stringify(create.json)}`);
      }
    }
  }

  if (DESTRUCTIVE) {
    logStep('Destructive run lifecycle');
    const routes = await request('/api/v1/admin/routes');
    if (!Array.isArray(routes.json) || routes.json.length === 0) {
      console.log('[SKIP] destructive run lifecycle (no route)');
    } else {
      const routeCode = routes.json[0].route_code;
      const create = await request('/api/v1/admin/runs', {
        method: 'POST',
        body: { route_code: routeCode },
      });
      if (create.res.status === 201) {
        logPass(`POST /api/v1/admin/runs (${routeCode})`, 'created');
        const runId = create.json?.id;
        if (typeof runId === 'string') {
          const end = await request(`/api/v1/admin/runs/${encodeURIComponent(runId)}/end`, {
            method: 'POST',
          });
          expectStatus(end.res.status, 200, `POST /api/v1/admin/runs/${runId}/end`, end.json);

          if (CLEANUP) {
            const del = await request(`/api/v1/admin/runs/${encodeURIComponent(runId)}`, {
              method: 'DELETE',
            });
            expectStatus(
              del.res.status,
              200,
              `DELETE /api/v1/admin/runs/${runId} (cleanup)`,
              del.json,
            );
          }
        } else {
          fail('create run id', JSON.stringify(create.json));
        }
      } else if (create.res.status === 409) {
        console.log('[SKIP] destructive run create (already active run exists)');
      } else {
        fail('POST /api/v1/admin/runs', `unexpected status ${create.res.status}`);
      }
    }
  }

  if (process.exitCode && process.exitCode !== 0) {
    console.error('\n[RESULT] FAILED');
    process.exit(process.exitCode);
  }

  console.log('\n[RESULT] PASSED');
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
