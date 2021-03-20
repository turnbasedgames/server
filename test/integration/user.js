const test = require('ava');
const { StatusCodes } = require('http-status-codes');

const { spawnApp, killApp } = require('../util/app');

test.before(async (t) => {
  const app = await spawnApp();
  // eslint-disable-next-line no-param-reassign
  t.context.app = app;
});

test.after.always(async (t) => {
  await killApp(t.context.app);
});

test('GET /user returns 401 if user is not authenticated', async (t) => {
  const { api } = t.context.app;
  const err = await t.throwsAsync(api.get('/user'));
  t.is(err.response.status, StatusCodes.UNAUTHORIZED);
});
