const socket = io();
let started = false;
let trackGuessed = false;
let artistGuessed = false;
let currentTrackName = '';
let currentArtistName = '';
let currentAlbumCover = '';
let currentUserInfo = null;
let lobbyLineInterval = null;

// Lobby line fetching and display
async function fetchAndDisplayLobbyLine() {
    const factElement = document.querySelector('.did-you-know-fact');
    if (!factElement) return;

    try {
        const response = await fetch('/vortex/lobby-line');
        if (!response.ok) {
            throw new Error(`Failed to load lobby line: ${response.status}`);
        }

        const data = await response.json();
        
        // Fade out first
        factElement.style.opacity = '0';
        
        setTimeout(() => {
            if (data.success && data.line) {
                factElement.textContent = data.line;
            } else {
                factElement.textContent = '';
            }
            // Fade in
            factElement.style.opacity = '1';
        }, 300);
    } catch (error) {
        console.error('Failed to fetch lobby line:', error);
        // On error, show default message
        factElement.style.opacity = '0';
        setTimeout(() => {
            factElement.textContent = '';
            factElement.style.opacity = '1';
        }, 300);
    }
}

// Start fetching lobby lines when in lobby
function startLobbyLineRotation() {
    const loaderContent = document.getElementById('loader-content');
    // Check if loader is visible (not explicitly hidden)
    if (loaderContent) {
        const computedStyle = window.getComputedStyle(loaderContent);
        const isHidden = loaderContent.style.display === 'none' || computedStyle.display === 'none';
        if (!isHidden) {
            // Fetch immediately
            fetchAndDisplayLobbyLine();
            // Then fetch every 8 seconds
            lobbyLineInterval = setInterval(fetchAndDisplayLobbyLine, 8000);
        }
    }
}

// Stop fetching lobby lines
function stopLobbyLineRotation() {
    if (lobbyLineInterval) {
        clearInterval(lobbyLineInterval);
        lobbyLineInterval = null;
    }
}

// Initialize lobby lines on page load
document.addEventListener('DOMContentLoaded', () => {
    startLobbyLineRotation();
});

// Player connection events
socket.on('player_connected', (data) => {
    console.log('Player connected:', data);
    showPlayerAlert(data.username, data.profileImage, 'joined');
});

socket.on('player_disconnected', (data) => {
    console.log('Player disconnected:', data);
    showPlayerAlert(data.username, data.profileImage, 'left');
});

socket.on('room_joined', (data) => {
    console.log('Joined room successfully:', data);
    
    // If game already started, show the player controls immediately
    if (data.gameStarted && !started) {
        stopLobbyLineRotation();
        let loader = document.getElementById('loader-content');
        if (loader) {
            loader.parentNode.removeChild(loader);
        }
        document.getElementById('player-controls').style.display = 'flex';
        started = true;
    }
});

// Alert system for player join/leave
let playerAlertQueue = [];
let playerAlertTimeout = null;

function showPlayerAlert(username, profileImage, action) {
    playerAlertQueue.push({ username, profileImage, action });
    processPlayerAlertQueue();
}

function processPlayerAlertQueue() {
    if (playerAlertQueue.length === 0 || playerAlertTimeout) {
        return;
    }

    const { username, profileImage, action } = playerAlertQueue.shift();
    const alertEl = document.getElementById('player-alert');
    const alertImg = document.getElementById('player-alert-img');
    const alertMsg = document.getElementById('player-alert-msg');
    
    if (!alertEl) return;
    
    const imgPath = profileImage ? (profileImage.startsWith('/') ? profileImage : '/' + profileImage.replace(/\\/g, '/')) : '/img/player.png';
    alertImg.src = imgPath;
    alertMsg.textContent = action === 'joined' ? `${username} joined the game!` : `${username} left the game`;
    alertEl.classList.add('show');
    alertEl.classList.toggle('join', action === 'joined');
    alertEl.classList.toggle('leave', action !== 'joined');

    playerAlertTimeout = setTimeout(() => {
        alertEl.classList.remove('show');
        playerAlertTimeout = null;
        setTimeout(() => processPlayerAlertQueue(), 500);
    }, 3000);
}

socket.on('server_command', (data) => {
    if(data === "game_ready"){
        stopLobbyLineRotation();
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
            
            // Fetch full user info and join socket room
            await fetchUserInfoAndJoinRoom();
        } else {
            console.error('Failed to fetch user ID');
        }
    } catch (error) {
        console.error('Error fetching user ID:', error);
    }
}

async function fetchUserInfoAndJoinRoom() {
    try {
        const response = await fetch('/vortex/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userIds: [currentUserID] })
        });
        
        if (response.ok) {
            const usersInfo = await response.json();
            if (usersInfo && usersInfo.length > 0) {
                currentUserInfo = usersInfo[0];
                
                // Join the socket room with user info
                socket.emit('join_room', {
                    roomCode: currentRoomCode,
                    userId: currentUserID,
                    username: currentUserInfo.username,
                    profileImage: currentUserInfo.profile_image,
                    isHost: false
                });
            }
        }
    } catch (error) {
        console.error('Error fetching user info:', error);
    }
}

// Extract room code immediately - needed for socket room join
function extractRoomCode() {
    const pathArray = window.location.pathname.split('/');
    const roomCodeIndex = pathArray.findIndex(element => element === "room") + 1;
    return pathArray[roomCodeIndex];
}

const roomCode = extractRoomCode();
const currentRoomCode = roomCode;

// Now fetch user and join room
fetchCurrentUserID();

function switchToPlayerMode() {
    var hostSelection = document.getElementById('host-selection');
    var loaderContent = document.getElementById('loader-content');

    hostSelection.style.display = 'none';
    loaderContent.style.display = 'block';
    startLobbyLineRotation();
}

// Update room code display
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
