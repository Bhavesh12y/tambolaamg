const socket = io();
let gameCode = '';
let myTicket = []; 
let calledNumbersList = [];
let hostName = '';

// 1. Create Game with Name
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

// 2. Handle Player List
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

// 3. Handle Chat
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

// ... (Rest of existing Host logic: Game Flow, Ticket, Claims) ...
// Copy your existing socket.on('numberDrawn'...), 'claimSuccess', functions here.
// IMPORTANT: Keep renderBoard(), renderHostTicket(), etc.

// --- RE-INSERTING ESSENTIAL HOST LOGIC FOR COMPLETENESS ---
socket.on('numberDrawn', ({ number, history }) => {
    document.getElementById('current-number').innerText = number;
    const cell = document.getElementById(`board-${number}`);
    if(cell) cell.classList.add('active');
    calledNumbersList = history;
    speakNumber(number);
});

socket.on('claimSuccess', ({ player, type }) => {
    alert(`🎉 ${player} claimed ${type}! Game Paused.`);
    updatePlayPauseUI(false);
});

socket.on('joinedSuccess', (data) => {
    myTicket = data.ticket;
    renderHostTicket(myTicket);
    document.getElementById('btn-get-ticket').classList.add('hidden');
    document.getElementById('host-ticket-container').classList.remove('hidden');
    document.getElementById('host-claims').classList.remove('hidden');
});

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

function getHostTicket() { socket.emit('joinGame', { gameCode, name: hostName }); }

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
                    else alert("Not called yet!");
                };
            }
            container.appendChild(div);
        });
    });
}
function claim(type) { socket.emit('claimPrize', { gameCode, type }); }
function speakNumber(n) { const u = new SpeechSynthesisUtterance(n); window.speechSynthesis.speak(u); }