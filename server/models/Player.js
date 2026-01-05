const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
    socketId: { type: String, required: true },
    name: { type: String, required: true },
    gameCode: { type: String, required: true },
    ticket: [[{ type: Number, default: 0 }]], // 3x9 Matrix. 0 represents empty.
    claims: [{ type: String }] // Array of won claims (e.g., 'TOP_ROW')
});

module.exports = mongoose.model('Player', playerSchema);