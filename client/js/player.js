const socket = io();
const params = new URLSearchParams(window.location.search);
const name = params.get('name');
const gameCode = params.get('code');

let myTicket = [];
let calledNumbersList = []; // Stores valid numbers

// Join Logic
socket.emit('joinGame', { gameCode, name });

socket.on('joinedSuccess', (data) => {
    myTicket = data.ticket;
    calledNumbersList = data.calledNumbers || []; // Load history on join
    renderTicket(myTicket);
    document.getElementById('status').innerText = `Joined Game: ${gameCode}`;
});

socket.on('gameStarted', () => {
    document.getElementById('status').innerText = "Game LIVE!";
    document.getElementById('claims-area').classList.remove('hidden');
});

socket.on('numberDrawn', ({ number, history }) => {
    document.getElementById('current-num-display').innerText = number;
    
    // Update local list of valid numbers
    calledNumbersList = history; 
    
    speakNumber(number);
});

socket.on('claimSuccess', ({ player, type }) => {
    alert(`🎉 ${player} won ${type}!`);
});

socket.on('claimFailed', (msg) => alert(`❌ ${msg}`));
socket.on('error', (msg) => alert(msg));

// --- Helpers ---

function renderTicket(ticket) {
    const container = document.getElementById('ticket-container');
    container.innerHTML = '';
    
    ticket.forEach((row) => {
        row.forEach((num) => {
            const div = document.createElement('div');
            div.className = 'cell';
            div.id = `cell-${num}`;
            
            if (num === 0) {
                div.classList.add('empty');
            } else {
                div.innerText = num;
                // 👇 Pass the number to the toggle function
                div.onclick = () => toggleMark(div, num);
                div.style.cursor = 'pointer'; 
            }
            container.appendChild(div);
        });
    });
}

function toggleMark(element, number) {
    // 👇 CHECK: Only allow marking if number is in the called list
    if (calledNumbersList.includes(number)) {
        element.classList.toggle('marked');
    } else {
        alert(`⚠️ Cheating? Number ${number} hasn't been called yet!`);
        // Optional: Add a CSS class to shake the box red for visual feedback
        element.style.borderColor = 'red';
        setTimeout(() => element.style.borderColor = '', 500);
    }
}

function claim(type) {
    socket.emit('claimPrize', { gameCode, type });
}

function speakNumber(num) {
    const utterance = new SpeechSynthesisUtterance(`Number ${num}`);
    window.speechSynthesis.speak(utterance);
}