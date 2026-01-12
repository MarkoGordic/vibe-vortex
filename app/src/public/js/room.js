const socket = io();
let started = false;
let trackGuessed = false;
let artistGuessed = false;
let currentTrackName = '';
let currentArtistName = '';
let currentAlbumCover = '';

socket.on('server_command', (data) => {
    if(data === "game_ready"){
        let loader = document.getElementById('loader-content');
        loader.parentNode.removeChild(loader);
        document.getElementById('player-controls').style.display = 'flex';
        started = true;
    }
    else if(data === "next_round"){
        // Reset track/artist guessed state
        trackGuessed = false;
        artistGuessed = false;
        currentTrackName = '';
        currentArtistName = '';
        currentAlbumCover = '';
        
        // Reset song guess
        document.getElementById('track-guessed-by').innerHTML = "";
        document.getElementById('song-badge').style.display = 'none';
        document.getElementById('song-placeholder').style.display = 'block';
        
        // Reset artist guess
        document.getElementById('artist-guessed-by').innerHTML = "";
        document.getElementById('artist-badge').style.display = 'none';
        document.getElementById('artist-placeholder').style.display = 'block';
        
        // Reset track info
        document.getElementById('track-name').innerHTML = "Unknown Track";
        document.getElementById('artist-name').innerHTML = "Unknown Artist";
        document.getElementById('track-name').classList.remove('revealed');
        document.getElementById('artist-name').classList.remove('revealed');
        
        // Reset album art
        document.getElementById('music-icon').style.display = 'block';
        document.getElementById('album-cover').style.display = 'none';
        document.getElementById('album-cover').src = '';
        document.getElementById('album-glow').classList.remove('active');
        
        // Reset last guess
        document.getElementById('last-guess-wrapper').style.display = 'none';
        document.getElementById('last-guess').innerHTML = "";
    }
    else if(data.action === "correct_track"){
        trackGuessed = true;
        document.getElementById('track-guessed-by').innerHTML = data.username;
        document.getElementById('song-badge').style.display = 'flex';
        document.getElementById('song-placeholder').style.display = 'none';
        
        // Store and show track name if provided
        if (data.trackName) {
            currentTrackName = data.trackName;
            document.getElementById('track-name').innerHTML = data.trackName;
            document.getElementById('track-name').classList.add('revealed');
        }
        
        // Store artist name and album cover for later
        if (data.artistName) currentArtistName = data.artistName;
        if (data.albumCover) currentAlbumCover = data.albumCover;
        
        // Check if both guessed to show album cover
        checkBothGuessed();
    }
    else if(data.action === "correct_artist"){
        artistGuessed = true;
        document.getElementById('artist-guessed-by').innerHTML = data.username;
        document.getElementById('artist-badge').style.display = 'flex';
        document.getElementById('artist-placeholder').style.display = 'none';
        
        // Store and show artist name if provided
        if (data.artistName) {
            currentArtistName = data.artistName;
            document.getElementById('artist-name').innerHTML = data.artistName;
            document.getElementById('artist-name').classList.add('revealed');
        }
        
        // Store track name and album cover for later
        if (data.trackName) currentTrackName = data.trackName;
        if (data.albumCover) currentAlbumCover = data.albumCover;
        
        // Check if both guessed to show album cover
        checkBothGuessed();
    }
    else {
        console.log(data);
    }
});

function checkBothGuessed() {
    if (trackGuessed && artistGuessed) {
        // Show album cover if available
        if (currentAlbumCover) {
            document.getElementById('music-icon').style.display = 'none';
            document.getElementById('album-cover').src = currentAlbumCover;
            document.getElementById('album-cover').style.display = 'block';
            document.getElementById('album-glow').classList.add('active');
        }
        
        // Ensure track name is shown
        if (currentTrackName) {
            document.getElementById('track-name').innerHTML = currentTrackName;
            document.getElementById('track-name').classList.add('revealed');
        }
        
        // Ensure artist name is shown
        if (currentArtistName) {
            document.getElementById('artist-name').innerHTML = currentArtistName;
            document.getElementById('artist-name').classList.add('revealed');
        }
    }
}

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

// End game confirmation modal functions
function showEndGameConfirm() {
    document.getElementById('end-game-modal').style.display = 'flex';
}

function hideEndGameConfirm() {
    document.getElementById('end-game-modal').style.display = 'none';
}

function confirmEndGame() {
    hideEndGameConfirm();
    socket.emit('host_command', 'end_game');
    deactivateRoom();
}

// Close modal on overlay click
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('end-game-modal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                hideEndGameConfirm();
            }
        });
    }
});

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
document.getElementById('room-code').innerHTML = roomCode;

function sendGuess() {
    const guessInput = document.getElementById('guess-input');
    const lastGuessElement = document.getElementById('last-guess');
    const lastGuessWrapper = document.getElementById('last-guess-wrapper');
    const guess = guessInput.value.trim();

    if (guess) {
        lastGuessElement.textContent = guess;
        lastGuessWrapper.style.display = 'flex';

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
