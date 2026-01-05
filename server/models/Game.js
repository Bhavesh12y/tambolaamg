const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
    gameCode: { type: String, unique: true, required: true },
    hostSocketId: { type: String },
    status: { type: String, enum: ['WAITING', 'LIVE', 'ENDED'], default: 'WAITING' },
    calledNumbers: [{ type: Number }],
    currentNumber: { type: Number, default: null },
    // 👇 NEW: Track which prizes have already been won
    takenClaims: [{ type: String }], 
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Game', gameSchema);