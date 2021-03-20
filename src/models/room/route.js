const express = require('express');
const { StatusCodes } = require('http-status-codes');
const asyncHandler = require('express-async-handler');
const { celebrate, Segments } = require('celebrate');
const mongoose = require('mongoose');
const assert = require('assert');

const Joi = require('../../middleware/joi');
const auth = require('../../middleware/auth');
const Room = require('./room');
const RoomUser = require('./roomUser');

const PATH = '/room';
const router = express.Router();

router.get('/',
  celebrate({
    [Segments.QUERY]: Joi.object().keys({
      gameId: Joi.objectId().required(),
      limit: Joi.number().integer().max(100).min(0)
        .default(25),
      skip: Joi.number().integer().min(0).default(0),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { query: { gameId, limit, skip } } = req;
    const rooms = await Room.find({ game: gameId }).populate('game').populate('leader').skip(skip)
      .limit(limit);
    res.status(StatusCodes.OK).json({ rooms });
  }));

router.post('/', auth, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const roomRaw = req.body;
  roomRaw.user = userId;
  const session = await mongoose.startSession();
  session.startTransaction();
  let room = await Room.create(roomRaw, { session });
  assert(room, 'Failed to create room');
  const roomUser = await RoomUser.create({ room: room.id, user: userId });
  assert(roomUser, 'Failed to create room user link');
  session.endSession();
  room = await room.populate('user').populate('game').populate('game.creator').execPopulate();
  res.status(StatusCodes.OK).json({ room });
}));

router.post('/:id/join', celebrate({
  [Segments.PARAMS]: Joi.object().keys({
    id: Joi.objectId(),
  }),
}), auth, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const room = await Room.findById(id);
  const roomUser = new RoomUser({ room: room.id, user: userId });
  await roomUser.save();
  res.status(StatusCodes.OK);
}));

router.get('/:id',
  celebrate({
    [Segments.PARAMS]: Joi.object().keys({
      id: Joi.objectId(),
    }),
  }), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const room = await Room.findById(id).populate('game').populate('game.creator').populate('leader');
    res.status(StatusCodes.OK).json({ room });
  }));

router.get('/:id/user',
  celebrate({
    [Segments.PARAMS]: Joi.object().keys({
      id: Joi.objectId(),
    }),
  }), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const roomUsers = await RoomUser.find({ room: id }).populate('user');
    res.status(StatusCodes.OK).json({ users: roomUsers.map((roomUser) => roomUser.user) });
  }));

router.get('/user/:id', celebrate({
  [Segments.PARAMS]: Joi.object().keys({
    id: Joi.objectId(),
  }),
  [Segments.QUERY]: Joi.object().keys({
    limit: Joi.number().integer().max(100).min(0)
      .default(25),
    skip: Joi.number().integer().min(0).default(0),
  }),
}), asyncHandler(async (req, res) => {
  const { query: { limit, skip }, params: { id } } = req;
  const roomUsers = await RoomUser
    .find({ user: id })
    .populate('room')
    .populate('room.leader')
    .populate('room.game')
    .populate('room.game.creator')
    .skip(skip)
    .limit(limit);
  res.status(StatusCodes.OK).json({ rooms: roomUsers.map((roomUser) => roomUser.room) });
}));

module.exports = {
  router,
  PATH,
};
