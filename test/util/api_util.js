const { StatusCodes } = require('http-status-codes');

async function createGameAndAssert(t, api, userCred, user) {
  const gameRaw = {
    name: 'test name',
    description: 'test description',
  };
  const authToken = await userCred.user.getIdToken();
  const { data: { game }, status } = await api.post('/game', gameRaw, { headers: { authorization: authToken } });
  t.is(status, StatusCodes.CREATED);
  t.deepEqual(game.creator, user);
  return game;
}

async function createUserAndAssert(t, api, userCred) {
  const authToken = await userCred.user.getIdToken();
  const { data: { user }, status } = await api.post('/user', {}, { headers: { authorization: authToken } });
  t.is(status, StatusCodes.CREATED);
  t.is(user.firebaseId, userCred.user.uid);
  return user;
}

module.exports = { createGameAndAssert, createUserAndAssert };
