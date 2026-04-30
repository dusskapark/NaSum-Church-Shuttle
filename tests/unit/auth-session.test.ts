import assert from 'node:assert/strict';
import test from 'node:test';

process.env.SESSION_SECRET = 'test-session-secret-with-32-characters';

const sessionPromise = import('@/server/session');
const authSessionRoutePromise = import('../../app/api/v1/auth/session/route');

test('session JWT only requires userId and role', async () => {
  const { signSession, verifySession } = await sessionPromise;
  const token = await signSession({
    userId: 'user-1',
    role: 'admin',
    authProvider: 'email_password',
    identityId: 'identity-1',
  });

  const actor = await verifySession(token);
  assert.equal(actor.userId, 'user-1');
  assert.equal(actor.role, 'admin');
  assert.equal(actor.authProvider, 'email_password');
  assert.equal(actor.identityId, 'identity-1');
  assert.equal(actor.providerUid, null);
});

test('auth/session rejects unsupported providers before credential verification', async () => {
  const authSessionRoute = await authSessionRoutePromise;
  const response = await authSessionRoute.POST(
    new Request('http://localhost/api/v1/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'unsupported',
        credential: {},
      }),
    }) as never,
  );

  assert.equal(response.status, 400);
  assert.match(await response.text(), /Unsupported auth provider/);
});
