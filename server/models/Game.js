const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
    gameCode: { type: String, unique: true, required: true },
    hostSocketId: { type: String },
    status: { type: String, enum: ['WAITING', 'LIVE', 'ENDED'], default: 'WAITING' },
    calledNumbers: [{ type: Number }], // Array of numbers already called
    currentNumber: { type: Number, default: null },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Game', gameSchema);