const test = require('ava');
const { StatusCodes } = require('http-status-codes');
const io = require('socket.io-client');

const { spawnApp, killApp } = require('../util/app');
const { createUserCred } = require('../util/firebase');
const {
  createUserAndAssert, createGameAndAssert, createRoomAndAssert, startTicTacToeRoom,
} = require('../util/api_util');
const { waitFor } = require('../util/util');

test.before(async (t) => {
  const app = await spawnApp();
  // eslint-disable-next-line no-param-reassign
  t.context.app = app;
});

test.after.always(async (t) => {
  const { app, sideApps } = t.context;
  await killApp(app);
  if (sideApps) {
    await Promise.all(sideApps.map((a) => killApp(a)));
  }
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

test('sockets can unwatch a room to no longer receive room:latestState events when state changes', async (t) => {
  const { api, baseURL } = t.context.app;
  const {
    userOne, userTwo, userCredOne, userCredTwo, room,
  } = await startTicTacToeRoom(t);
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
  const createSocket = () => {
    const socket = io(baseURL);
    socket.emit('watchRoom', { roomId: room.id });
    socket.messageHistory = [];
    socket.on('room:latestState', (message) => socket.messageHistory.push(message));
    return socket;
  };
  const socket1 = await createSocket();
  const socket2 = await createSocket();

  const { status: statusMove1 } = await api.post(`/room/${room.id}/move`, { x: 0, y: 0 },
    { headers: { authorization: await userCredOne.user.getIdToken() } });
  t.is(statusMove1, StatusCodes.OK);

  await assertNextLatestState([socket1, socket2], {
    room: room.id,
    version: 2,
    state: {
      board: [['X', null, null], [null, null, null], [null, null, null]],
      plrs: [userOne.id, userTwo.id],
      state: 'IN_GAME',
      winner: null,
    },
  });

  socket2.emit('unwatchRoom', { roomId: room.id });

  const { status: statusMove2 } = await api.post(`/room/${room.id}/move`, { x: 0, y: 1 },
    { headers: { authorization: await userCredTwo.user.getIdToken() } });
  t.is(statusMove2, StatusCodes.OK);

  await assertNextLatestState([socket1], {
    room: room.id,
    version: 3,
    state: {
      board: [['X', 'O', null], [null, null, null], [null, null, null]],
      plrs: [userOne.id, userTwo.id],
      state: 'IN_GAME',
      winner: null,
    },
  });

  await t.throwsAsync(assertNextLatestState([socket2], {
    room: room.id,
    version: 3,
    state: {
      board: [['X', 'O', null], [null, null, null], [null, null, null]],
      plrs: [userOne.id, userTwo.id],
      state: 'IN_GAME',
      winner: null,
    },
  }));
});

test('sockets can be connected to different nodejs instances and receive events for room:latestState', async (t) => {
  const sideApps = await Promise.all([...Array(3).keys()].map(() => spawnApp()));
  const { app } = t.context;
  const { api } = app;
  const {
    userOne, userTwo, userCredOne, userCredTwo, room,
  } = await startTicTacToeRoom(t);
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
  const createSocket = ({ baseURL }) => {
    const socket = io(baseURL);
    socket.emit('watchRoom', { roomId: room.id });
    socket.messageHistory = [];
    socket.on('room:latestState', (message) => socket.messageHistory.push(message));
    return socket;
  };
  const sockets = await Promise.all([...Array(10).keys()].map((_, index) => {
    const apps = [app, ...sideApps];
    return createSocket(apps[index % 4]);
  }));

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
