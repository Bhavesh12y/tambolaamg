const socketIO = require('socket.io');
const Game = require('./models/Game');
const Player = require('./models/Player');
const { generateTicket } = require('./utils/ticketLogic');

const gameIntervals = {};

// --- POINTS CONFIGURATION ---
const POINTS = {
    'LADDU': 1,            'EARLY_FIVE': 1,
    'KING_CORNERS': 1,     'QUEEN_CORNERS': 1,   'CORNERS': 2,
    'SMALLEST_5': 1,       'BIGGEST_5': 1,       'RULE_123': 2,
    'TOP_ROW': 2,          'MIDDLE_ROW': 2,      'BOTTOM_ROW': 2,
    'FULL_HOUSE': 5
};

module.exports = (server) => {
    const io = socketIO(server);

    // ... (Keep performDraw, createGame, startGame, joinGame logic same as before) ...
    // ... Copy the helper 'performDraw' and socket connection logic from previous response ...
    
    // I will focus on the UPDATED Logic inside io.on('connection') 
    
    // (Paste your performDraw function here from previous code)
    const performDraw = async (gameCode) => {
        const game = await Game.findOne({ gameCode });
        if (!game || game.status !== 'LIVE' || game.calledNumbers.length >= 90) {
            if (gameIntervals[gameCode]) clearInterval(gameIntervals[gameCode]);
            return;
        }
        let num;
        do { num = Math.floor(Math.random() * 90) + 1; } while (game.calledNumbers.includes(num));
        
        game.calledNumbers.push(num);
        game.currentNumber = num;
        await game.save();

        io.to(gameCode).emit('numberDrawn', { number: num, history: game.calledNumbers });
    };

    io.on('connection', (socket) => {
        
        // --- EXISTING SETUP EVENTS (createGame, startGame, joinGame, etc.) ---
        // (Use the code from the previous step for these standard events)

        socket.on('createGame', async ({ hostName }) => {
            const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const newGame = new Game({ gameCode, hostSocketId: socket.id });
            await newGame.save();
            // Host is a player too
            const hostPlayer = new Player({ socketId: socket.id, name: hostName + " (Host)", gameCode, ticket: [] });
            await hostPlayer.save();
            socket.join(gameCode);
            socket.emit('gameCreated', { gameCode });
            io.to(gameCode).emit('updatePlayerList', [hostPlayer]);
        });

        socket.on('startGame', async ({ gameCode }) => {
            await Game.updateOne({ gameCode }, { status: 'LIVE' });
            io.to(gameCode).emit('gameStarted');
        });

        socket.on('joinGame', async ({ gameCode, name }) => {
            const game = await Game.findOne({ gameCode });
            if (!game) return socket.emit('error', 'Invalid Game Code');

            const ticket = generateTicket();
            const newPlayer = new Player({ socketId: socket.id, name, gameCode, ticket });
            await newPlayer.save();

            socket.join(gameCode);
            socket.emit('joinedSuccess', { 
                ticket, gameCode, calledNumbers: game.calledNumbers, 
                takenClaims: game.takenClaims // Send what's already gone
            });

            const allPlayers = await Player.find({ gameCode }).sort({ score: -1 });
            io.to(gameCode).emit('updatePlayerList', allPlayers);
        });

        socket.on('startAutoDraw', ({ gameCode }) => {
            if (gameIntervals[gameCode]) return;
            performDraw(gameCode);
            gameIntervals[gameCode] = setInterval(() => performDraw(gameCode), 3500);
        });

        socket.on('pauseAutoDraw', ({ gameCode }) => {
            if (gameIntervals[gameCode]) { clearInterval(gameIntervals[gameCode]); delete gameIntervals[gameCode]; }
        });

        socket.on('sendChat', ({ gameCode, message, playerName }) => {
            io.to(gameCode).emit('receiveChat', { message, playerName });
        });

        // --- 🏆 UPDATED CLAIM LOGIC ---

        socket.on('claimPrize', async ({ gameCode, type }) => {
            const game = await Game.findOne({ gameCode });
            const player = await Player.findOne({ socketId: socket.id });

            if (!game || !player) return;

            // 1. CHECK: Is this prize already taken?
            if (game.takenClaims.includes(type)) {
                return socket.emit('claimFailed', 'Too slow! This prize is already taken.');
            }

            // 2. CHECK: Is the claim valid?
            const isValid = validateClaim(player.ticket, game.calledNumbers, type);

            if (isValid) {
                // UPDATE GAME: Lock the prize
                game.takenClaims.push(type);
                await game.save();

                // UPDATE PLAYER: Add claim and Score
                player.claims.push(type);
                player.score += (POINTS[type] || 1);
                await player.save();

                // Pause the game momentarily
                if (gameIntervals[gameCode]) {
                    clearInterval(gameIntervals[gameCode]);
                    delete gameIntervals[gameCode];
                    io.to(gameCode).emit('autoDrawPaused');
                }

                // BROADCAST SUCCESS & UPDATED SCORES
                const allPlayers = await Player.find({ gameCode }).sort({ score: -1 });
                
                io.to(gameCode).emit('claimSuccess', { 
                    player: player.name, 
                    type: type, 
                    score: player.score 
                });
                
                io.to(gameCode).emit('updatePlayerList', allPlayers); // Update leaderboard
                io.to(gameCode).emit('prizeTaken', { type }); // Tell clients to disable button

                // Check Game Over (Full House)
                if (type === 'FULL_HOUSE') {
                    // Find winner
                    const winner = allPlayers[0]; // Sorted by score desc
                    io.to(gameCode).emit('gameOver', { 
                        winnerName: winner.name, 
                        score: winner.score 
                    });
                }

            } else {
                socket.emit('claimFailed', 'BOGEY! Invalid Claim.');
            }
        });
    });
};

// --- 🧠 COMPLEX VALIDATION LOGIC ---

function validateClaim(ticket, calledNums, type) {
    const calledSet = new Set(calledNums);
    const isMarked = (n) => n !== 0 && calledSet.has(n);
    
    // Helper: Get all non-zero numbers in the ticket
    const allNums = ticket.flat().filter(n => n !== 0);
    const sortedNums = [...allNums].sort((a,b) => a - b);

    // Helper: Get non-zero numbers for a specific row
    const getRow = (r) => ticket[r].filter(n => n !== 0);

    switch (type) {
        case 'EARLY_FIVE':
            return allNums.filter(n => calledSet.has(n)).length >= 5;

        case 'LADDU':
            // Laddu = The exact middle number of the grid (Row 1, Col 4)
            // If it's 0 (empty), then this ticket HAS NO Laddu, cannot claim.
            const ladduNum = ticket[1][4];
            return ladduNum !== 0 && calledSet.has(ladduNum);

        case 'TOP_ROW': return getRow(0).every(isMarked);
        case 'MIDDLE_ROW': return getRow(1).every(isMarked);
        case 'BOTTOM_ROW': return getRow(2).every(isMarked);

        case 'KING_CORNERS':
            // 1st number of Top Row AND Last number of Top Row
            const top = getRow(0);
            return isMarked(top[0]) && isMarked(top[top.length-1]);

        case 'QUEEN_CORNERS':
            // 1st number of Bottom Row AND Last number of Bottom Row
            const bottom = getRow(2);
            return isMarked(bottom[0]) && isMarked(bottom[bottom.length-1]);

        case 'CORNERS':
            // King Corners + Queen Corners (All 4 corners)
            const t = getRow(0);
            const b = getRow(2);
            return isMarked(t[0]) && isMarked(t[t.length-1]) &&
                   isMarked(b[0]) && isMarked(b[b.length-1]);

        case 'RULE_123':
            // At least 1 from Top, 2 from Middle, 3 from Bottom marked
            const c1 = getRow(0).filter(n => calledSet.has(n)).length;
            const c2 = getRow(1).filter(n => calledSet.has(n)).length;
            const c3 = getRow(2).filter(n => calledSet.has(n)).length;
            return c1 >= 1 && c2 >= 2 && c3 >= 3;

        case 'SMALLEST_5':
            // The 5 smallest numbers on the ticket must be called
            const small5 = sortedNums.slice(0, 5);
            return small5.every(isMarked);

        case 'BIGGEST_5':
            // The 5 largest numbers on the ticket must be called
            const big5 = sortedNums.slice(-5);
            return big5.every(isMarked);

        case 'FULL_HOUSE':
            return allNums.every(isMarked);

        default: return false;
    }
}