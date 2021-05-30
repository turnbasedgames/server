const mongoose = require('mongoose');

const { Schema } = mongoose;

const roomStateSchema = new Schema({
  room: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Room',
    index: true,
  },
  state: {
    type: Schema.Types.Mixed,
    required: true,
    default: {},
  },
  version: {
    type: Schema.Types.Number,
    required: true,
    default: 0,
  },
}, { timestamps: true });

roomStateSchema.index({ room: 1, version: 1 }, { unique: true });

module.exports = mongoose.model('RoomState', roomStateSchema);
