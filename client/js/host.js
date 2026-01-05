const socket = io();
let gameCode = '';
let myTicket = []; 
let calledNumbersList = []; // Stores history of numbers called to validate marking

// --- INITIALIZATION ---

// Create Game immediately when page loads
socket.emit('createGame');

socket.on('gameCreated', (data) => {
    gameCode = data.gameCode;
    document.getElementById('game-code-display').innerText = gameCode;
    renderBoard();
});

socket.on('playerJoined', ({ name }) => {
    console.log(`${name} joined`); 
    // Optional: Add a visual toast/notification here if you want
});

// --- GAME FLOW EVENTS ---

socket.on('numberDrawn', ({ number, history }) => {
    // 1. Update Big Display
    document.getElementById('current-number').innerText = number;
    
    // 2. Highlight Number on the 1-90 Master Board
    const boardCell = document.getElementById(`board-${number}`);
    if(boardCell) boardCell.classList.add('active');
    
    // 3. Update the list of valid numbers (for manual checking)
    calledNumbersList = history; 
    
    // 4. Speak the number
    speakNumber(number);
});

socket.on('claimSuccess', ({ player, type }) => {
    alert(`🎉 ${player} claimed ${type}! Game Paused.`);
    // Automatically switch UI to paused state since someone won
    updatePlayPauseUI(false);
});

socket.on('autoDrawPaused', () => {
    // Sync UI if server auto-pauses
    updatePlayPauseUI(false);
});

// --- HOST AS PLAYER EVENTS ---

socket.on('joinedSuccess', (data) => {
    myTicket = data.ticket;
    calledNumbersList = data.calledNumbers || []; // Sync history just in case
    
    // Render the host's personal ticket
    renderHostTicket(myTicket);
    
    // Switch UI to show the ticket
    document.getElementById('btn-get-ticket').classList.add('hidden');
    document.getElementById('host-ticket-container').classList.remove('hidden');
    document.getElementById('host-claims').classList.remove('hidden');
});

// --- CONTROLLER FUNCTIONS ---

function startGame() {
    socket.emit('startGame', { gameCode });
    document.getElementById('btn-start').classList.add('hidden');
    document.getElementById('btn-play').classList.remove('hidden');
}

function togglePlay(shouldPlay) {
    if (shouldPlay) {
        socket.emit('startAutoDraw', { gameCode });
        updatePlayPauseUI(true);
    } else {
        socket.emit('pauseAutoDraw', { gameCode });
        updatePlayPauseUI(false);
    }
}

function updatePlayPauseUI(isPlaying) {
    if (isPlaying) {
        document.getElementById('btn-play').classList.add('hidden');
        document.getElementById('btn-pause').classList.remove('hidden');
    } else {
        document.getElementById('btn-play').classList.remove('hidden');
        document.getElementById('btn-pause').classList.add('hidden');
    }
}

// --- HOST PLAYER LOGIC ---

function getHostTicket() {
    socket.emit('joinGame', { gameCode, name: 'HOST' });
}

function renderHostTicket(ticket) {
    const container = document.getElementById('host-ticket-container');
    container.innerHTML = '';
    
    ticket.forEach((row) => {
        row.forEach((num) => {
            const div = document.createElement('div');
            div.className = 'cell';
            div.id = `host-cell-${num}`;
            
            if (num === 0) {
                div.classList.add('empty');
            } else {
                div.innerText = num;
                
                // 👇 MANUAL MARKING LOGIC WITH VALIDATION
                div.onclick = () => {
                    // Check if the number is in the called list
                    if (calledNumbersList.includes(num)) {
                        div.classList.toggle('marked');
                    } else {
                        // User tried to cheat or clicked early
                        alert(`⚠️ Number ${num} hasn't been called yet!`);
                    }
                };
                div.style.cursor = 'pointer';
            }
            container.appendChild(div);
        });
    });
}

function claim(type) {
    // 👇 PRE-CHECK: Did you actually mark the numbers?
    if (validateLocalClaim(type)) {
        socket.emit('claimPrize', { gameCode, type });
    } else {
        // 🚨 ALERT! BOGEY CALL!
        alert("❌ BOGEY! You haven't marked the required numbers yet!");
    }
}

// --- UTILITIES ---

function validateLocalClaim(type) {
    // 1. Get all numbers the user has physically marked (GREEN cells)
    const markedCells = document.querySelectorAll('.cell.marked');
    const markedNums = Array.from(markedCells).map(el => parseInt(el.innerText));
    const markedSet = new Set(markedNums);

    // 2. Get the actual numbers from the ticket rows (excluding 0s)
    // myTicket is available globally from the 'joinedSuccess' event
    const row0 = myTicket[0].filter(n => n !== 0);
    const row1 = myTicket[1].filter(n => n !== 0);
    const row2 = myTicket[2].filter(n => n !== 0);

    // Helper to check if a specific row is fully inside the marked set
    const isRowComplete = (rowNums) => rowNums.every(num => markedSet.has(num));

    // 3. Check specific rules
    switch (type) {
        case 'EARLY_FIVE':
            return markedSet.size >= 5;
        
        case 'TOP_ROW':
            return isRowComplete(row0);
            
        case 'MIDDLE_ROW':
            return isRowComplete(row1);
            
        case 'BOTTOM_ROW':
            return isRowComplete(row2);
            
        case 'FULL_HOUSE':
            return isRowComplete(row0) && isRowComplete(row1) && isRowComplete(row2);
            
        default:
            return false;
    }
}
function renderBoard() {
    const board = document.getElementById('board');
    for(let i=1; i<=90; i++) {
        const div = document.createElement('div');
        div.className = 'board-cell';
        div.id = `board-${i}`;
        div.innerText = i;
        board.appendChild(div);
    }
}

function speakNumber(num) {
    // Simple Text-to-Speech
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(num.toString());
        window.speechSynthesis.speak(utterance);
    }
}