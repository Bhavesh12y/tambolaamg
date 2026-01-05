const socket = io();
const params = new URLSearchParams(window.location.search);
const name = params.get('name');
const gameCode = params.get('code');

let myTicket = [];
let calledNumbersList = [];

// Join Game
socket.emit('joinGame', { gameCode, name });

// --- 1. INITIAL SYNC & SETUP ---

socket.on('joinedSuccess', (data) => {
    myTicket = data.ticket;
    calledNumbersList = data.calledNumbers || [];
    
    // Render Ticket & Board
    renderTicket(myTicket);
    renderBoard(); 
    
    // Mark numbers that were already called on the 1-90 board
    calledNumbersList.forEach(num => {
        document.getElementById(`board-${num}`).classList.add('active');
    });

    // Sync Taken Prizes (Disable buttons if joining late)
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

    document.getElementById('status').innerText = `Room: ${gameCode}`;
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

// --- 3. GAME EVENTS ---

socket.on('gameStarted', () => {
    document.getElementById('status').innerText = "Game LIVE!";
    document.getElementById('claims-area').classList.remove('hidden');
});

socket.on('numberDrawn', ({ number, history }) => {
    document.getElementById('current-num-display').innerText = number;
    calledNumbersList = history;

    // Update 1-90 Board
    const cell = document.getElementById(`board-${number}`);
    if(cell) cell.classList.add('active');

    speakNumber(number);
});

// --- 4. CHAT SYSTEM ---

socket.on('receiveChat', ({ message, playerName }) => {
    const box = document.getElementById('chat-history');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<strong>${playerName}:</strong> ${message}`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
});

function sendChat(msg) {
    socket.emit('sendChat', { gameCode, message: msg, playerName: name });
}

// --- 5. CLAIMS & PRIZES ---

socket.on('claimSuccess', ({ player, type }) => {
    alert(`🎉 ${player} won ${type}!`);
});

socket.on('claimFailed', (msg) => {
    alert(`❌ ${msg}`);
});

// Disable button if prize is taken (Exclusive Claims)
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

// --- 6. UTILS & RENDERERS ---

function renderTicket(ticket) {
    const container = document.getElementById('ticket-container');
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

function claim(type) { 
    socket.emit('claimPrize', { gameCode, type }); 
}

function speakNumber(n) { 
    const u = new SpeechSynthesisUtterance(n); 
    window.speechSynthesis.speak(u); 
}