const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
    socketId: { type: String, required: true },
    name: { type: String, required: true },
    gameCode: { type: String, required: true },
    ticket: [[{ type: Number, default: 0 }]], 
    claims: [{ type: String }],
    // 👇 NEW: Track score
    score: { type: Number, default: 0 } 
});

module.exports = mongoose.model('Player', playerSchema);