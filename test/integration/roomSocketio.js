const test = require('ava');
const { StatusCodes } = require('http-status-codes');
const io = require('socket.io-client');

const { spawnApp, killApp } = require('../util/app');
const { createUserCred } = require('../util/firebase');
const {
  createUserAndAssert, createGameAndAssert, createRoomAndAssert, startTicTacToeRoom,
} = require('../util/api_util');
const { waitFor } = require('../util/util');
// TODO: generally, create test for multiple servers
// TODO: generally, create a test for socket unwatchRoom or socket.disconnect
test.before(async (t) => {
  const app = await spawnApp();
  // eslint-disable-next-line no-param-reassign
  t.context.app = app;
});

test.after.always(async (t) => {
  await killApp(t.context.app);
});

test('sockets that emit watchRoom with a room id will get events for room:latestState when the state changes', async (t) => {
  const { api, baseURL } = t.context.app;
  const userCredOne = await createUserCred();
  const userCredTwo = await createUserCred();
  const userOne = await createUserAndAssert(t, api, userCredOne);
  const userTwo = await createUserAndAssert(t, api, userCredTwo);
  const game = await createGameAndAssert(t, api, userCredOne, userOne);
  const room = await createRoomAndAssert(t, api, userCredOne, game, userOne);
  const waitForNextEvent = (watches) => Promise.all(watches.map(({ messageHistory }) => waitFor(
    () => {
      if (messageHistory.length > 0) {
        return messageHistory.shift();
      }
      throw Error('No messages received!');
    },
    1000,
    200,
    "Didn't get room update",
  )));
  const assertNextLatestState = async (sockets, expectedState) => {
    const watchStates = await waitForNextEvent(sockets);
    watchStates.forEach((state) => t.deepEqual(state, { id: state.id, ...expectedState }));
  };
  const sockets = [...Array(10).keys()].map(() => {
    const socket = io(baseURL);
    socket.emit('watchRoom', { roomId: room.id });
    socket.messageHistory = [];
    socket.on('room:latestState', (message) => socket.messageHistory.push(message));
    return socket;
  });

  const { data: { room: resRoom }, status } = await api.post(`/room/${room.id}/join`, {},
    { headers: { authorization: await userCredTwo.user.getIdToken() } });
  t.is(status, StatusCodes.CREATED);
  t.deepEqual(resRoom, {
    id: room.id,
    leader: userOne,
    game,
    latestState: {
      id: resRoom.latestState.id,
      version: 1,
      room: room.id,
      state: {
        board: [
          [
            null,
            null,
            null,
          ],
          [
            null,
            null,
            null,
          ],
          [
            null,
            null,
            null,
          ],
        ],
        plrs: [userOne.id, userTwo.id],
        state: 'IN_GAME',
        winner: null,
      },
    },
  });

  await assertNextLatestState(sockets, {
    room: room.id,
    version: 1,
    state: {
      board: [[null, null, null], [null, null, null], [null, null, null]],
      plrs: [userOne.id, userTwo.id],
      state: 'IN_GAME',
      winner: null,
    },
  });

  const { status: statusMove1 } = await api.post(`/room/${room.id}/move`, { x: 0, y: 0 },
    { headers: { authorization: await userCredOne.user.getIdToken() } });
  t.is(statusMove1, StatusCodes.OK);

  await assertNextLatestState(sockets, {
    room: room.id,
    version: 2,
    state: {
      board: [['X', null, null], [null, null, null], [null, null, null]],
      plrs: [userOne.id, userTwo.id],
      state: 'IN_GAME',
      winner: null,
    },
  });

  const { status: statusMove2 } = await api.post(`/room/${room.id}/move`, { x: 0, y: 1 },
    { headers: { authorization: await userCredTwo.user.getIdToken() } });
  t.is(statusMove2, StatusCodes.OK);

  await assertNextLatestState(sockets, {
    room: room.id,
    version: 3,
    state: {
      board: [['X', 'O', null], [null, null, null], [null, null, null]],
      plrs: [userOne.id, userTwo.id],
      state: 'IN_GAME',
      winner: null,
    },
  });
});
