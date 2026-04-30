import assert from 'node:assert/strict';
import test from 'node:test';

process.env.LINE_LOGIN_CHANNEL_ID = '1653812014';

const lineAuthPromise = import('@/server/line-auth');
const lineSessionRoutePromise = import('../../app/api/v1/line-auth/session/route');

test('verifyLineAccessToken accepts a valid profile-scoped token', async () => {
  const lineAuth = await lineAuthPromise;
  const originalFetch = global.fetch;
  global.fetch = (async () =>
    new Response(
      JSON.stringify({
        scope: 'profile openid',
        client_id: '1653812014',
        expires_in: 1800,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )) as typeof fetch;

  try {
    const result = await lineAuth.verifyLineAccessToken('token-value');
    assert.equal(result.client_id, '1653812014');
    assert.equal(result.expires_in, 1800);
  } finally {
    global.fetch = originalFetch;
  }
});

test('verifyLineAccessToken rejects mismatched client_id', async () => {
  const lineAuth = await lineAuthPromise;
  const originalFetch = global.fetch;
  global.fetch = (async () =>
    new Response(
      JSON.stringify({
        scope: 'profile',
        client_id: 'unexpected',
        expires_in: 1800,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )) as typeof fetch;

  try {
    await assert.rejects(
      () => lineAuth.verifyLineAccessToken('token-value'),
      /client_id mismatch/,
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('verifyLineAccessToken rejects missing profile scope', async () => {
  const lineAuth = await lineAuthPromise;
  const originalFetch = global.fetch;
  global.fetch = (async () =>
    new Response(
      JSON.stringify({
        scope: 'openid',
        client_id: '1653812014',
        expires_in: 1800,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )) as typeof fetch;

  try {
    await assert.rejects(
      () => lineAuth.verifyLineAccessToken('token-value'),
      /missing profile scope/,
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('fetchLineProfile normalizes LINE profile payload', async () => {
  const lineAuth = await lineAuthPromise;
  const originalFetch = global.fetch;
  global.fetch = (async () =>
    new Response(
      JSON.stringify({
        userId: 'U123',
        displayName: 'NaSum Rider',
        pictureUrl: 'https://example.com/avatar.png',
        statusMessage: 'Ready to ride',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )) as typeof fetch;

  try {
    const profile = await lineAuth.fetchLineProfile('token-value');
    assert.deepEqual(profile, {
      sub: 'U123',
      displayName: 'NaSum Rider',
      pictureUrl: 'https://example.com/avatar.png',
      statusMessage: 'Ready to ride',
      email: null,
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('line-auth/session rejects payloads with both token types', async () => {
  const lineSessionRoute = await lineSessionRoutePromise;
  const response = await lineSessionRoute.POST(
    new Request('http://localhost/api/v1/line-auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: 'access-token',
        idToken: 'id-token',
      }),
    }) as never,
  );

  assert.equal(response.status, 400);
  assert.match(await response.text(), /exactly one LINE token/i);
});

test('line-auth/session rejects payloads with no token', async () => {
  const lineSessionRoute = await lineSessionRoutePromise;
  const response = await lineSessionRoute.POST(
    new Request('http://localhost/api/v1/line-auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }) as never,
  );

  assert.equal(response.status, 400);
  assert.match(await response.text(), /accessToken or idToken is required/i);
});
