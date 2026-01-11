const socket = io();
let started = false;

socket.on('server_command', (data) => {
    if(data === "game_ready"){
        let loader = document.getElementById('loader-content');
        loader.parentNode.removeChild(loader);
        document.getElementById('player-controls').style.display = 'block';
        started = true;
    }
    else if(data === "next_round"){
        document.getElementById('track-guessed-by').innerHTML = "N/A";
        document.getElementById('artist-guessed-by').innerHTML = "N/A";
    }
    else if(data.action === "correct_track"){
        document.getElementById('track-guessed-by').innerHTML = data.username;
    }
    else if(data.action === "correct_artist"){
        document.getElementById('artist-guessed-by').innerHTML = data.username;
    }else{
        console.log(data);
    }
});

socket.on('host_command', (data) => {
    if (data === "end_game"){
        setTimeout(() => {
            window.location.href = "/vortex/setup";
        }, 1500);
    }
});

function deactivateRoom() {
    fetch('/vortex/deactivate_room', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ roomCode: currentRoomCode })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log("Room deactivated successfully");
                window.location.href = '/vortex/setup';
            } else {
                console.error("Failed to deactivate room: ", data.message);
            }
        })
        .catch(error => console.error('Error deactivating room:', error));
}

let currentUserID;

async function fetchCurrentUserID() {
    try {
        const response = await fetch('/vortex/me');
        if (response.ok) {
            const data = await response.json();
            currentUserID = data.userId;
            console.log('Current User ID:', currentUserID);
        } else {
            console.error('Failed to fetch user ID');
        }
    } catch (error) {
        console.error('Error fetching user ID:', error);
    }
}

fetchCurrentUserID();

const facts = [
    'Spotify streams over 100,000 tracks every minute.',
    'The first song on Spotify was added in 2006.',
    'A typical human heart beats in time with music.',
    'Shorter intros make songs more likely to be replayed.'
];

function showFact() {
    const factElement = document.querySelector('.did-you-know-fact');
    if (!facts.length) {
        return;
    }
    const randomFact = facts[Math.floor(Math.random() * facts.length)];
    factElement.textContent = `${randomFact}`;
    factElement.style.opacity = 1;
    setTimeout(() => {
        factElement.style.opacity = 0;
    }, 7000);
}

setInterval(() => {
    if (!started) {
        showFact();
    }
}, 8000);

function switchToPlayerMode() {
    var hostSelection = document.getElementById('host-selection');
    var loaderContent = document.getElementById('loader-content');

    hostSelection.style.display = 'none';
    loaderContent.style.display = 'block';
}

function extractRoomCode() {
    const pathArray = window.location.pathname.split('/');
    const roomCodeIndex = pathArray.findIndex(element => element === "room") + 1;
    return pathArray[roomCodeIndex];
}

const roomCode = extractRoomCode();
document.getElementById('room-code').innerHTML = "ROOM CODE : " + roomCode;

async function fetchAndSetGameTypeImage() {
    try {
        const response = await fetch(`/vortex/room/preferences/${roomCode}`);
        const preferences = await response.json();

        if (preferences && preferences.game_type) {
            let imageUrl;
            switch (preferences.game_type) {
                case 'guessing':
                    imageUrl = '/img/guessing.png';
                    break;
                case 'lyrics':
                case 'continue-lyrics':
                    imageUrl = '/img/lyrics.png';
                    break;
            }
            document.getElementById('game-type-image').src = imageUrl;
        }
    } catch (error) {
        console.error('Error fetching game preferences:', error);
    }
}

fetchAndSetGameTypeImage();

function sendGuess() {
    const guessInput = document.getElementById('guess-input');
    const lastGuessElement = document.getElementById('last-guess');
    const guess = guessInput.value.trim();

    if (guess) {
        lastGuessElement.textContent = "Last Guess: " + guess;

        const guessData = {
            guess: guess,
            action: "guess",
            userId: currentUserID
        };

        socket.emit('player_action', guessData);

        guessInput.value = '';
    }
}

document.getElementById('send-guess').addEventListener('click', sendGuess);
document.getElementById('guess-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendGuess();
    }
});

const currentRoomCode = roomCode;
