const socket = io();
const params = new URLSearchParams(window.location.search);
const name = params.get('name');
const gameCode = params.get('code');

let myTicket = [];
let calledNumbersList = [];

socket.emit('joinGame', { gameCode, name });

// 1. Initial Render & Sync
socket.on('joinedSuccess', (data) => {
    myTicket = data.ticket;
    calledNumbersList = data.calledNumbers || [];
    renderTicket(myTicket);
    renderBoard(); // Render empty 1-90 board
    
    // Mark numbers that were already called
    calledNumbersList.forEach(num => {
        document.getElementById(`board-${num}`).classList.add('active');
    });

    document.getElementById('status').innerText = `Room: ${gameCode}`;
});

// 2. Player List Sync
socket.on('updatePlayerList', (players) => {
    const container = document.getElementById('players-list');
    container.innerHTML = '';
    players.forEach(p => {
        const initial = p.name.charAt(0).toUpperCase();
        const html = `
            <div class="player-icon">
                <div class="avatar">${initial}</div>
                <div class="player-name">${p.name}</div>
            </div>
        `;
        container.innerHTML += html;
    });
});

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

// 3. Chat Logic
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

socket.on('claimSuccess', ({ player, type }) => {
    alert(`🎉 ${player} won ${type}!`);
});

// --- Renders ---

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

function claim(type) { socket.emit('claimPrize', { gameCode, type }); }
function speakNumber(n) { const u = new SpeechSynthesisUtterance(n); window.speechSynthesis.speak(u); }