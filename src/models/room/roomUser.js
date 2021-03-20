const mongoose = require('mongoose');

const { Schema } = mongoose;

const RoomUserSchema = new Schema({
  room: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Room',
    index: true,
  },
  user: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    index: true,
  },
}, { timestamps: true });

RoomUserSchema.method('toJSON', function toJSON() {
  return {
    id: this.id,
    room: this.room,
    user: this.user,
  };
});

module.exports = mongoose.model('RoomUser', RoomUserSchema);
