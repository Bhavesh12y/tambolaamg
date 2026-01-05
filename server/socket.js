const socketIO = require('socket.io');
const Game = require('./models/Game');
const Player = require('./models/Player');
const { generateTicket } = require('./utils/ticketLogic');

// Store intervals for auto-drawing (Map: gameCode -> intervalID)
const gameIntervals = {};

module.exports = (server) => {
    const io = socketIO(server);

    // Helper: The logic to draw a number (reused for manual & auto)
    const performDraw = async (gameCode) => {
        const game = await Game.findOne({ gameCode });
        // Stop if game over or not live
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
        
        socket.on('createGame', async () => {
            const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const newGame = new Game({ gameCode, hostSocketId: socket.id });
            await newGame.save();
            socket.join(gameCode);
            socket.emit('gameCreated', { gameCode });
        });

        socket.on('startGame', async ({ gameCode }) => {
            await Game.updateOne({ gameCode }, { status: 'LIVE' });
            io.to(gameCode).emit('gameStarted');
        });

        // Manual Draw (Optional now)
        socket.on('drawNumber', ({ gameCode }) => performDraw(gameCode));

        // NEW: Auto Play Start
        socket.on('startAutoDraw', ({ gameCode }) => {
            if (gameIntervals[gameCode]) return; // Already running
            
            // Draw immediately, then every 3.5 seconds
            performDraw(gameCode); 
            gameIntervals[gameCode] = setInterval(() => {
                performDraw(gameCode);
            }, 3500); // 3.5 seconds delay between numbers
        });

        // NEW: Auto Play Pause
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

            // ... (Ticket generation and Player creation logic remains same) ...
            
            const ticket = generateTicket();
            const newPlayer = new Player({
                socketId: socket.id,
                name,
                gameCode,
                ticket
            });
            await newPlayer.save();

            socket.join(gameCode);

            // 👇 UPDATED: Send 'calledNumbers' (history) so player knows what is valid
            socket.emit('joinedSuccess', { 
                ticket, 
                gameCode,
                calledNumbers: game.calledNumbers 
            });

            if(game.hostSocketId !== socket.id) {
                io.to(game.hostSocketId).emit('playerJoined', { name });
            }
        });

        socket.on('claimPrize', async ({ gameCode, type }) => {
            const player = await Player.findOne({ socketId: socket.id });
            const game = await Game.findOne({ gameCode });
            if (!player || !game) return;

            const isValid = validateClaim(player.ticket, game.calledNumbers, type);

            if (isValid && !player.claims.includes(type)) {
                player.claims.push(type);
                await player.save();
                
                // Pause game automatically when someone wins!
                if (gameIntervals[gameCode]) {
                    clearInterval(gameIntervals[gameCode]);
                    delete gameIntervals[gameCode];
                    io.to(gameCode).emit('autoDrawPaused'); // Notify UI to update buttons
                }

                io.to(gameCode).emit('claimSuccess', { player: player.name, type });
            } else {
                socket.emit('claimFailed', 'Bogey! False Claim.');
            }
        });
    });
};

function validateClaim(ticket, calledNums, type) {
    const calledSet = new Set(calledNums);
    const isMarked = (num) => num === 0 || calledSet.has(num);
    const rowFull = (r) => ticket[r].every(isMarked);
    
    switch (type) {
        case 'EARLY_FIVE':
            let count = 0;
            ticket.flat().forEach(n => { if(n !== 0 && calledSet.has(n)) count++; });
            return count >= 5;
        case 'TOP_ROW': return rowFull(0);
        case 'MIDDLE_ROW': return rowFull(1);
        case 'BOTTOM_ROW': return rowFull(2);
        case 'FULL_HOUSE': return rowFull(0) && rowFull(1) && rowFull(2);
        default: return false;
    }
}