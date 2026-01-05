const socketIO = require('socket.io');
const Game = require('./models/Game');
const Player = require('./models/Player');
const { generateTicket } = require('./utils/ticketLogic');

const gameIntervals = {};

module.exports = (server) => {
    const io = socketIO(server);

    const performDraw = async (gameCode) => {
        const game = await Game.findOne({ gameCode });
        if (!game || game.status !== 'LIVE' || game.calledNumbers.length >= 90) {
            if (gameIntervals[gameCode]) {
                clearInterval(gameIntervals[gameCode]);
                delete gameIntervals[gameCode];
            }
            return;
        }

        let num;
        do {
            num = Math.floor(Math.random() * 90) + 1;
        } while (game.calledNumbers.includes(num));

        game.calledNumbers.push(num);
        game.currentNumber = num;
        await game.save();

        io.to(gameCode).emit('numberDrawn', { 
            number: num, 
            history: game.calledNumbers 
        });
    };

    io.on('connection', (socket) => {
        
        // --- HOST EVENTS ---
        socket.on('createGame', async ({ hostName }) => {
            const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            
            // Save host as a "Player" too so they appear in the list
            const newGame = new Game({ gameCode, hostSocketId: socket.id });
            await newGame.save();

            // Register Host in the player list (optional, but good for UI)
            const hostPlayer = new Player({
                socketId: socket.id,
                name: hostName + " (Host)",
                gameCode,
                ticket: [] // Host might not have a ticket initially
            });
            await hostPlayer.save();

            socket.join(gameCode);
            socket.emit('gameCreated', { gameCode });
            
            // Broadcast initial player list
            io.to(gameCode).emit('updatePlayerList', [hostPlayer]);
        });

        socket.on('startGame', async ({ gameCode }) => {
            await Game.updateOne({ gameCode }, { status: 'LIVE' });
            io.to(gameCode).emit('gameStarted');
        });

        socket.on('startAutoDraw', ({ gameCode }) => {
            if (gameIntervals[gameCode]) return;
            performDraw(gameCode); 
            gameIntervals[gameCode] = setInterval(() => performDraw(gameCode), 3500);
        });

        socket.on('pauseAutoDraw', ({ gameCode }) => {
            if (gameIntervals[gameCode]) {
                clearInterval(gameIntervals[gameCode]);
                delete gameIntervals[gameCode];
            }
        });

        // --- PLAYER EVENTS ---
        socket.on('joinGame', async ({ gameCode, name }) => {
            const game = await Game.findOne({ gameCode });
            if (!game) return socket.emit('error', 'Invalid Game Code');

            const ticket = generateTicket();
            const newPlayer = new Player({
                socketId: socket.id,
                name,
                gameCode,
                ticket
            });
            await newPlayer.save();

            socket.join(gameCode);
            socket.emit('joinedSuccess', { 
                ticket, 
                gameCode, 
                calledNumbers: game.calledNumbers 
            });

            // Update everyone's player list
            const allPlayers = await Player.find({ gameCode });
            io.to(gameCode).emit('updatePlayerList', allPlayers);
        });

        socket.on('claimPrize', async ({ gameCode, type }) => {
            const player = await Player.findOne({ socketId: socket.id });
            const game = await Game.findOne({ gameCode });
            if (!player || !game) return;

            // (Validation logic omitted for brevity, assume same as before)
            // ... add your validateClaim function here if needed ...

            player.claims.push(type);
            await player.save();
            
            if (gameIntervals[gameCode]) {
                clearInterval(gameIntervals[gameCode]);
                delete gameIntervals[gameCode];
                io.to(gameCode).emit('autoDrawPaused');
            }

            io.to(gameCode).emit('claimSuccess', { player: player.name, type });
        });

        // --- CHAT EVENTS ---
        socket.on('sendChat', ({ gameCode, message, playerName }) => {
            io.to(gameCode).emit('receiveChat', { message, playerName });
        });

        // --- DISCONNECT ---
        socket.on('disconnect', async () => {
            const player = await Player.findOne({ socketId: socket.id });
            if (player) {
                await Player.deleteOne({ socketId: socket.id });
                const allPlayers = await Player.find({ gameCode: player.gameCode });
                io.to(player.gameCode).emit('updatePlayerList', allPlayers);
            }
        });
    });
};