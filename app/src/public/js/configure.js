const socket = io();

let currentTab = 0;
showTab(currentTab);
let playlistsLoaded = false;
let devicesLoaded = false;

function showTab(n) {
    let tabs = document.getElementsByClassName("tab");
    tabs[n].style.display = "block";
    fixStepIndicator(n);

    if (n === 2 && !playlistsLoaded) {
        loadAndDisplayPlaylistsForCurrentUser();
        playlistsLoaded = true;
    }
    if (n === 3 && !devicesLoaded) {
        loadAndDisplayDevices();
        devicesLoaded = true;
    }
}

function navigateTabs(n) {
    let tabs = document.getElementsByClassName("tab");

    if (currentTab + n >= tabs.length) {
        return false;
    } else if (currentTab + n < 0) {
        return false;
    }

    if (n === 1 && !validateForm()) return false;

    tabs[currentTab].style.display = "none";
    currentTab += n;
    showTab(currentTab);
}

function validateForm() {
    return true;
}

function fixStepIndicator(n) {
    let indicators = document.getElementsByClassName("tab-indicator");
    for (let i = 0; i < indicators.length; i++) {
        indicators[i].className = indicators[i].className.replace(" completed", "");
    }
    for (let i = 0; i <= n; i++) {
        indicators[i].className += " completed";
    }
}

document.querySelectorAll('.half').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.half').forEach(innerItem => {
            innerItem.classList.remove('selected');
        });
        item.classList.add('selected');
    });
});

const defaultGameType = document.getElementById('guessing');
if (defaultGameType) {
    defaultGameType.classList.add('selected');
}


const currentRoomCode = document.getElementById('room-code').innerText.split(': ')[1];
updatePlayerList(currentRoomCode);

socket.on('player_joined', (data) => {
    if (data.roomCode === currentRoomCode) {
        updatePlayerList(currentRoomCode);
    }
});

function updatePlayerList(roomCode) {
    fetch(`/vortex/room/players`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ roomCode: roomCode })
    })
        .then(response => response.json())
        .then(playerIds => {
            return fetch(`/vortex/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userIds: playerIds })
            });
        })
        .then(response => response.json())
        .then(players => {
            const playerList = document.getElementById('playerList');
            playerList.innerHTML = '';

            players.forEach(player => {
                const playerItem = document.createElement('li');
                playerItem.className = 'player-item';
                let profileImagePath = player.profile_image ? player.profile_image.replace(/\\/g, '/') : 'img/player.png';
                if (!profileImagePath.startsWith('/')) {
                    profileImagePath = `/${profileImagePath}`;
                }
                playerItem.innerHTML = `
                <img class="player-icon" src="${profileImagePath}" alt="User's Profile Picture">
                <span class="player-name">${player.username}</span>
                <button class="button-ban" onclick="banPlayer('${player.id}')">Ban</button>
            `;
                playerList.appendChild(playerItem);
            });
        })
        .catch(error => console.error('Error fetching user info:', error));
}

function banPlayer(playerId) {
    // TODO: Implement ban logic
    console.log(`Ban player with ID: ${playerId}`);
}

function loadAndDisplayPlaylistsForCurrentUser() {
    fetch(`/spotify/my_playlists`)
        .then(response => response.json())
        .then(playlists => {
            console.log(playlists);
            generatePlaylistsHTML(playlists);
        })
        .catch(error => console.error('Error fetching playlists:', error));
}

let totalTracks = 0;
let selectedTracks = 0;

function updateTrackRange() {
    const trackRange = document.getElementById('track-range');
    trackRange.max = totalTracks;
    trackRange.value = Math.min(selectedTracks, totalTracks);
    document.getElementById('selected-tracks').textContent = `Selected Tracks: ${trackRange.value}`;
}

function handleTrackRangeChange() {
    const trackRange = document.getElementById('track-range');
    selectedTracks = parseInt(trackRange.value, 10);
    document.getElementById('selected-tracks').textContent = `Selected Tracks: ${selectedTracks}`;
}

document.getElementById('track-range').addEventListener('input', handleTrackRangeChange);

function generatePlaylistsHTML(playlists) {
    const playlistContainer = document.createElement('div');
    playlistContainer.className = 'playlist-container';

    playlists.forEach(playlist => {
        const playlistItem = document.createElement('div');
        playlistItem.className = 'playlist-item';
        playlistItem.dataset.trackCount = playlist.tracks.total;
        playlistItem.dataset.playlistId = playlist.id;

        const icon = document.createElement('img');
        icon.className = 'playlist-icon';
        icon.src = playlist.images && playlist.images.length > 0 ? playlist.images[0].url : '/img/logo.png';

        const info = document.createElement('div');
        info.className = 'playlist-info';

        const name = document.createElement('p');
        name.className = 'playlist-name';
        name.textContent = playlist.name;

        const author = document.createElement('p');
        author.className = 'playlist-author';
        author.textContent = `${playlist.owner.display_name} - ${playlist.tracks.total} tracks`;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'playlist-checkbox';
        checkbox.addEventListener('change', () => updateTrackCount(playlistItem, checkbox));

        playlistItem.appendChild(icon);
        playlistItem.appendChild(info);
        info.appendChild(name);
        info.appendChild(author);
        playlistItem.appendChild(checkbox);
        playlistContainer.appendChild(playlistItem);
    });

    const playlistWrap = document.getElementById('playlist-wrap');
    playlistWrap.innerHTML = '';
    playlistWrap.appendChild(playlistContainer);

    updateTrackRange();
}

function updateTrackCount(playlistItem, checkbox) {
    const trackCount = parseInt(playlistItem.dataset.trackCount, 10);
    const playlistNameElement = playlistItem.querySelector('.playlist-name');

    if (checkbox.checked) {
        totalTracks += trackCount;
        playlistNameElement.style.color = '#1DB954';
    } else {
        totalTracks -= trackCount;
        playlistNameElement.style.color = 'white';
    }

    updateTrackRange();
}

// Lazy-load playlists when the user reaches the playlists tab.

function loadAndDisplayDevices() {
    fetch('/spotify/devices')
        .then(response => response.json())
        .then(data => {
            const deviceContainer = document.getElementById('speaker-selection-container');
            deviceContainer.innerHTML = '';

            if (!data || data.length === 0) {
                const emptyState = document.createElement('p');
                emptyState.textContent = 'No active devices found. Open Spotify on a device and refresh.';
                emptyState.style.color = '#8c8c8c';
                deviceContainer.appendChild(emptyState);
                return;
            }

            data.forEach(device => {
                const deviceItem = document.createElement('div');
                deviceItem.className = 'device-item';
                deviceItem.setAttribute('data-device-id', device.id);

                const icon = document.createElement('i');
                const iconClass = getIconClassForDeviceType(device.type);
                icon.className = `fa ${iconClass} device-icon`;

                const name = document.createElement('span');
                name.className = 'device-name';
                name.textContent = device.name;

                const checkbox = document.createElement('input');
                checkbox.type = 'radio';
                checkbox.name = 'device-selection';
                checkbox.className = 'device-checkbox';
                checkbox.value = device.id;
                if (device.is_active) {
                    checkbox.checked = true;
                }

                checkbox.addEventListener('change', () => handleDeviceSelectionChange(device.id));

                deviceItem.appendChild(icon);
                deviceItem.appendChild(name);
                deviceItem.appendChild(checkbox);
                deviceContainer.appendChild(deviceItem);
            });

            setupDeviceSelection();
        })
        .catch(error => console.error('Error fetching devices:', error));
}

function getIconClassForDeviceType(type) {
    switch (type.toLowerCase()) {
        case 'computer': return 'fa-desktop';
        case 'smartphone': return 'fa-mobile';
        case 'speaker': return 'fa-volume-up';
        default: return 'fa-question-circle';
    }
}

function setupDeviceSelection() {
    const devices = document.querySelectorAll('.device-checkbox');

    devices.forEach(device => {
        device.addEventListener('change', () => {
            if (device.checked) {
                uncheckOtherDevices(device);
            }
        });
    });
}

function uncheckOtherDevices(selectedDevice) {
    const devices = document.querySelectorAll('.device-checkbox');

    devices.forEach(device => {
        if (device !== selectedDevice) {
            device.checked = false;
        }
    });
}

function handleDeviceSelectionChange(selectedDeviceId) {
    console.log("Selected Device ID:", selectedDeviceId);
}

// Lazy-load devices when the user reaches the devices tab.

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

function collectAndSendPreferences() {
    const gameType = document.querySelector('.half.selected')?.id || 'guessing';
    const selectedPlaylists = [];
    document.querySelectorAll('.playlist-checkbox:checked').forEach(checkbox => {
        const playlistId = checkbox.closest('.playlist-item').dataset.playlistId;
        selectedPlaylists.push(playlistId);
    });

    const trackLimit = parseInt(document.getElementById('track-range').value, 10) || 0;
    const selectedDeviceId = document.querySelector('.device-checkbox:checked')?.value || '';

    const otherPreferences = {
        show_track_info: document.getElementById('showTrackInfo').checked
    };

    const configuration = {
        game_type: gameType,
        playlists: selectedPlaylists,
        track_limit: trackLimit,
        device_id: selectedDeviceId,
        preferences: otherPreferences
    };

    fetch('/vortex/configure/save', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(configuration)
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log("Preferences saved successfully");
                window.location.href = "/vortex/room/" + currentRoomCode;
            } else {
                console.error("Failed to save preferences: ", data.message);
            }
        })
        .catch(error => console.error('Error saving preferences:', error));
}
