const socket = io();
let gameCode = '';
let myTicket = []; 
let calledNumbersList = [];
let hostName = '';

// --- 1. LOBBY & SETUP ---

function createGame() {
    hostName = document.getElementById('hostNameInput').value;
    if(!hostName) return alert("Please enter a name!");

    socket.emit('createGame', { hostName });
}

socket.on('gameCreated', (data) => {
    gameCode = data.gameCode;
    document.getElementById('lobby-section').classList.add('hidden');
    document.getElementById('game-dashboard').classList.remove('hidden');
    document.getElementById('chat-box').classList.remove('hidden');
    document.getElementById('game-code-display').innerText = gameCode;
    renderBoard();
});

// --- 2. PLAYER LIST & LEADERBOARD ---

socket.on('updatePlayerList', (players) => {
    const container = document.getElementById('players-list');
    container.innerHTML = '';
    
    // Sort players by score (Highest Trophies first)
    players.sort((a,b) => b.score - a.score);

    players.forEach(p => {
        const initial = p.name.charAt(0).toUpperCase();
        // Show Trophy icon if score > 0
        const scoreDisplay = p.score > 0 ? `🏆 ${p.score}` : '';
        
        const html = `
            <div class="player-icon">
                <div class="avatar">${initial}</div>
                <div class="player-name">${p.name}</div>
                <div class="player-score">${scoreDisplay}</div>
            </div>
        `;
        container.innerHTML += html;
    });
});

// --- 3. CHAT SYSTEM ---

socket.on('receiveChat', ({ message, playerName }) => {
    const box = document.getElementById('chat-history');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<strong>${playerName}:</strong> ${message}`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
});

function sendChat(msg) {
    socket.emit('sendChat', { gameCode, message: msg, playerName: hostName });
}

// --- 4. GAME FLOW & EVENTS ---

socket.on('numberDrawn', ({ number, history }) => {
    // Update Big Display
    document.getElementById('current-number').innerText = number;
    
    // Highlight on 1-90 Board
    const cell = document.getElementById(`board-${number}`);
    if(cell) cell.classList.add('active');
    
    calledNumbersList = history;
    speakNumber(number);
});

// Handle Claims (Success)
socket.on('claimSuccess', ({ player, type }) => {
    alert(`🎉 ${player} claimed ${type}! Game Paused.`);
    updatePlayPauseUI(false);
});

// Handle Claims (Failure)
socket.on('claimFailed', (msg) => {
    alert(`❌ ${msg}`);
});

// disable button if prize is taken (Exclusive Claims)
socket.on('prizeTaken', ({ type }) => {
    const btn = document.getElementById(`btn-${type}`);
    if (btn) {
        btn.disabled = true;
        btn.classList.add('taken');
        btn.innerText = "❌ TAKEN";
    }
});

// Game Over Screen
socket.on('gameOver', ({ winnerName, score }) => {
    const div = document.createElement('div');
    div.className = 'winner-overlay';
    div.innerHTML = `
        <div class="trophy-icon">🏆</div>
        <h1 style="color:gold;">GAME OVER</h1>
        <h2>Winner: ${winnerName}</h2>
        <h3>Total Trophies: ${score}</h3>
        <button onclick="window.location.reload()">Play Again</button>
    `;
    document.body.appendChild(div);
    speakNumber(`Game Over. The winner is ${winnerName}`);
});

// --- 5. HOST PLAYING LOGIC ---

function getHostTicket() { 
    socket.emit('joinGame', { gameCode, name: hostName }); 
}

socket.on('joinedSuccess', (data) => {
    myTicket = data.ticket;
    renderHostTicket(myTicket);
    
    // Hide "Get Ticket" button, show Ticket and Claims
    document.getElementById('btn-get-ticket').classList.add('hidden');
    document.getElementById('host-ticket-container').classList.remove('hidden');
    document.getElementById('host-claims').classList.remove('hidden');

    // Sync Taken Prizes (if joining late or refreshing)
    if (data.takenClaims) {
        data.takenClaims.forEach(type => {
            const btn = document.getElementById(`btn-${type}`);
            if(btn) {
                btn.disabled = true;
                btn.classList.add('taken');
                btn.innerText = "❌ TAKEN";
            }
        });
    }
});

// --- 6. CONTROLS ---

function startGame() {
    socket.emit('startGame', { gameCode });
    document.getElementById('btn-start').classList.add('hidden');
    document.getElementById('btn-play').classList.remove('hidden');
}

function togglePlay(val) {
    val ? socket.emit('startAutoDraw', { gameCode }) : socket.emit('pauseAutoDraw', { gameCode });
    updatePlayPauseUI(val);
}

function updatePlayPauseUI(isPlaying) {
    document.getElementById('btn-play').classList.toggle('hidden', isPlaying);
    document.getElementById('btn-pause').classList.toggle('hidden', !isPlaying);
}

socket.on('autoDrawPaused', () => {
    updatePlayPauseUI(false);
});

// --- 7. UTILS & RENDERERS ---

function renderBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    for(let i=1; i<=90; i++) {
        const div = document.createElement('div');
        div.className = 'board-cell';
        div.id = `board-${i}`;
        div.innerText = i;
        board.appendChild(div);
    }
}

function renderHostTicket(ticket) {
    const container = document.getElementById('host-ticket-container');
    container.innerHTML = '';
    ticket.forEach(row => {
        row.forEach(num => {
            const div = document.createElement('div');
            div.className = 'cell';
            if(num===0) div.classList.add('empty');
            else {
                div.innerText = num;
                div.onclick = () => {
                    if(calledNumbersList.includes(num)) div.classList.toggle('marked');
                    else alert("Cheat? Not called yet!");
                };
            }
            container.appendChild(div);
        });
    });
}

function claim(type) { 
    socket.emit('claimPrize', { gameCode, type }); 
}

function speakNumber(n) { 
    const u = new SpeechSynthesisUtterance(n); 
    window.speechSynthesis.speak(u); 
}