const socket = io();
let gameReady = false;
let nextRoundEnabled = true;

socket.on('server_command', (data) => {
    if(data === "game_ready"){
        document.getElementById('loader-content').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('podium-guessed-by').style.opacity = '1';
            document.getElementById('podium-display-wrap').style.opacity = '1';
        }, 500);
    }
});

socket.on('host_command', (data) => {
    if (data === "next_round") {
        if(gameReady && nextRoundEnabled)
            nextRound();
    }
    else if (data === "end_game"){
        setTimeout(() => {
            window.location.href = "/vortex/setup";
        }, 1000);
    }
});

socket.on('player_action', (data) => {
    if (data.action === "guess") {
        checkMessage(data.guess, data.userId);
    }
});

const currentRoomCode = document.getElementById('room-code').innerText.split(': ')[1];
const leaderboard = document.querySelector('.podium-leaderboard');
let limitedTracks;

function showLeaderboard() {
    populateLeaderboard();

    leaderboard.style.left = '0';

    setTimeout(() => {
        leaderboard.style.left = '-300px';
    }, 7000);
}

let playersData = [];

async function fetchPlayersInfo(playerIds) {
    try {
        const response = await fetch(`/vortex/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userIds: playerIds })
        });
        const usersInfo = await response.json();
        return usersInfo.map(userInfo => ({ ...userInfo, points: 0 }));
    } catch (error) {
        console.error('Error fetching users info:', error);
        return [];
    }
}

async function initializePlayersData(roomCode) {
    try {
        const response = await fetch(`/vortex/room/players`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ roomCode: roomCode })
        });
        const playerIds = await response.json();
        console.log(playerIds);

        const playersInfo = await fetchPlayersInfo(playerIds);
        playersData = playersInfo;

        console.log(playersData); // For debugging
    } catch (error) {
        console.error('Error initializing players data:', error);
    }
}

function sortPlayersByPoints() {
    playersData.sort((a, b) => b.points - a.points);
}

function populateLeaderboard() {
    sortPlayersByPoints();

    for (let i = 0; i < playersData.length; i++) {
        const player = playersData[i];
        const leaderboardPlace = document.getElementById(`place${i + 1}`);

        let profileImagePath = player.profile_image ? player.profile_image.replace(/\\/g, '/') : '/img/player.png';
        if (!profileImagePath.startsWith('/')) {
            profileImagePath = `/${profileImagePath}`;
        }

        if (leaderboardPlace) {
            leaderboardPlace.innerHTML = `
                <div class="leaderboard-placement-wrap">
                    <p class="leaderboard-placement">${ordinalSuffixOf(i + 1)}</p>
                </div>
                <img src="${profileImagePath}" alt="${player.username}'s profile picture">
                <div class="leaderboard-place-info">
                    <p class="leaderboard-name">${player.username}</p>
                    <p class="leaderboard-points">${player.points} pts</p>
                </div>`;
        }
    }
}

function ordinalSuffixOf(i) {
    var j = i % 10,
        k = i % 100;
    if (j === 1 && k !== 11) {
        return i + "st";
    }
    if (j === 2 && k !== 12) {
        return i + "nd";
    }
    if (j === 3 && k !== 13) {
        return i + "rd";
    }
    return i + "th";
}

let gamePreferences = {};
let aggregatedTracks = [];

async function fetchGamePreferences(roomCode){
    try {
        const response = await fetch(`/vortex/room/preferences/${roomCode}`);
        gamePreferences = await response.json();
    } catch (error) {
        console.error('Error fetching game preferences:', error);
    }
}

async function aggregatePlaylists(playlistIds) {
    try {
        const response = await fetch(`/spotify/aggregate_playlists`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ playlistIds })
        });
        const tracks = await response.json();
        aggregatedTracks = aggregatedTracks.concat(tracks);
    } catch (error) {
        console.error('Error fetching tracks for playlists:', error);
    }
}

function shuffleAndLimitTracks(tracks, trackLimit, shuffleRounds = 3) {
    for (let round = 0; round < shuffleRounds; round++) {
        for (let i = tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
        }
    }

    return tracks.slice(0, trackLimit);
}

function getVibrantColor(imgSrc, callback) {
    const img = new Image();
    img.crossOrigin = 'Anonymous';

    img.onload = function() {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;

        context.drawImage(img, 0, 0);

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let colorMap = {};

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const alpha = data[i + 3] / 255;

            if (alpha < 0.1) continue; // Skip nearly transparent pixels

            const hsl = rgbToHsl(r, g, b);
            const saturation = hsl[1];
            const lightness = hsl[2];

            // Adjust the saturation to make the color more vibrant
            const adjustedSaturation = Math.min(1, saturation * 1.5); // Increase saturation by 50%

            if (lightness > 0.2 && lightness < 0.8) {
                const vibrantHsl = [hsl[0], adjustedSaturation, hsl[2]];
                const vibrantRgb = hslToRgb(...vibrantHsl);
                const key = vibrantRgb.join(',');

                if (!colorMap[key]) {
                    colorMap[key] = 0;
                }
                colorMap[key] += 1;
            }
        }

        const vibrantColor = Object.keys(colorMap).reduce(
            (a, b) => colorMap[a] > colorMap[b] ? a : b
        );

        callback(`rgb(${vibrantColor})`);
    };

    img.src = imgSrc;
}

function hslToRgb(h, s, l){
    let r, g, b;

    if (s === 0){
        r = g = b = l; // achromatic
    } else {
        function hue2rgb(p, q, t){
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function rgbToHsl(r, g, b) {
    r /= 255, g /= 255, b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h, s, l];
}

async function initializeGame() {
    await initializePlayersData(currentRoomCode);
    populateLeaderboard();
    await fetchGamePreferences(currentRoomCode);
    if (gamePreferences && gamePreferences.playlists) {
        await aggregatePlaylists(gamePreferences.playlists);
    }
    limitedTracks = shuffleAndLimitTracks(aggregatedTracks, gamePreferences.track_limit);
    totalTracks = limitedTracks.length;

    socket.emit('server_command', 'game_ready');
    gameReady = true;
}

initializeGame();

let currentTrack = -1;
let totalTracks, trackName, trackArtists, accentColorString, trackIMG;
let trackURI,artistURIs, albumURI;

let nameGuessed = false, artistGuessed = false;
let guessingEnabled;

async function nextRound() {
    guessingEnabled = false;
    let timeDelay = 0
    socket.emit("server_command", 'next_round');

    console.log(currentTrack);
    if((!nameGuessed || !artistGuessed) && currentTrack !== -1){
        showLeaderboard();
        nextRoundEnabled = false;

        if (gamePreferences.preferences && gamePreferences.preferences.show_track_info) {
            timeDelay = 5000;
            document.getElementById('track-name').innerHTML = trackName;
            document.getElementById('track-author').innerHTML = trackArtists;
            document.getElementById("track-image").style.backgroundImage = 'url(' + trackIMG +')';
            document.getElementById("track-image").style.boxShadow = `0 0 50px ${accentColorString}`;
        }
    }

    setTimeout(async () => {
        leaderboard.style.left = '-300px';

        nameGuessed = false;
        artistGuessed = false;

        document.getElementById('track-name').innerHTML = "Unknown Track";
        document.getElementById('track-author').innerHTML = "Unknown Artist";
        document.getElementById("track-image").style.boxShadow = `0 0 0`;
        document.getElementById("track-image").style.backgroundImage = "none";
        document.getElementById('track-guessed-by').innerHTML = "N/A";
        document.getElementById('artist-guessed-by').innerHTML = "N/A";
        document.getElementById("track-guessed-by-circle").style.boxShadow = `0 0 0`;
        document.getElementById("artist-guessed-by-circle").style.boxShadow = `0 0 0`;
        document.getElementById('artist-guessed-by-i').style.color = 'white';
        document.getElementById('track-guessed-by-i').style.color = 'white';

        currentTrack++;

        if (currentTrack >= totalTracks) {
            endGame();
            return;
        }

        trackName = limitedTracks[currentTrack].track.name;
        //TODO: FIX getVibrantColor -> Maybe preform calculations on backend?
        //getVibrantColor(limitedTracks[currentTrack].track.album.images[0].url, (color) => {
        //    accentColorString = color;
        //});
        accentColorString = "rgb(255,255,255)"
        trackIMG = limitedTracks[currentTrack].track.album.images[0].url;
        trackURI = limitedTracks[currentTrack].track.uri;
        artistURIs = limitedTracks[currentTrack].track.artists.map(artist => artist.uri);
        albumURI = limitedTracks[currentTrack].track.album.uri;
        let artistNamesArray = limitedTracks[currentTrack].track.artists.map(artist => artist.name);
        trackArtists = artistNamesArray.join(", ");

        try {
            const response = await fetch(`/spotify/play?uri=${encodeURIComponent(trackURI)}`);
            const result = await response.text();
            console.log(result);
        } catch (error) {
            console.error('Error starting playback:', error);
        }

        console.log(limitedTracks[currentTrack].track);
        bonusPoints(trackURI, artistURIs, albumURI);
        guessingEnabled = true;
        nextRoundEnabled = true;
    }, timeDelay);
}

function updateDisplay(){
    if (nameGuessed && artistGuessed){
        document.getElementById("track-image").style.backgroundImage = 'url(' + trackIMG +')';
        document.getElementById("track-name").innerHTML = trackName;
        document.getElementById("track-author").innerHTML = trackArtists;
        document.getElementById("track-image").style.boxShadow = `0 0 50px ${accentColorString}`;
        sortPlayersByPoints();
        populateLeaderboard();
        showLeaderboard();
        return;
    }

    if(nameGuessed)
        document.getElementById("track-name").innerHTML = trackName;
    if(artistGuessed)
        document.getElementById("track-author").innerHTML = trackArtists;
}

function formatGameString(msg) {
    return msg
        .toLowerCase()
        .replace(/č/g, "c")
        .replace(/ć/g, "c")
        .replace(/đ/g, "dj")
        .replace(/š/g, "s")
        .replace(/ž/g, "z")
        .replace(/\s+/g, ' ')
        .trim();
}

function checkMessage(msg, userID) {
    if (!guessingEnabled) return;

    const formattedMsg = formatGameString(msg);
    const formattedTrackName = formatGameString(trackName);
    const formattedArtistNames = trackArtists.split(', ').map(artist => formatGameString(artist));

    if (formattedMsg === formattedTrackName && !nameGuessed) {
        nameGuessed = true;
        updateGuesserInfo(userID, "track");
    }

    if (formattedArtistNames.includes(formattedMsg) && !artistGuessed) {
        artistGuessed = true;
        updateGuesserInfo(userID, "artist");
    }

    updateDisplay();
}

function updateGuesserInfo(userID, type) {
    const normalizedId = Number(userID);
    const player = playersData.find(player => Number(player.id) === normalizedId);
    if (player) {
        document.getElementById(type + "-guessed-by").textContent = `${player.username}`;
        document.getElementById(type + "-guessed-by-circle").style.boxShadow = `0 0 30px ${accentColorString}`;
        document.getElementById(type + "-guessed-by-i").style.color = `${accentColorString}`;

        let profileImagePath = player.profile_image ? player.profile_image.replace(/\\/g, '/') : '/img/player.png';
        if (!profileImagePath.startsWith('/')) {
            profileImagePath = `/${profileImagePath}`;
        }

        const guessedLabel = type === 'track' ? 'track name' : 'artist';
        pushAlert(profileImagePath, `${player.username} just guessed ${guessedLabel}!`, accentColorString);

        let data = {
            action: "correct_" + type,
            username:player.username
        }
        player.points += 1;

        socket.emit('server_command', data);
    }
}

let alertQueue = [];

function pushAlert(avatar, message, colorString) {
    alertQueue.push({ avatar, message, colorString });
    processAlertQueue();
}

let alertTimeout;
function processAlertQueue() {
    if (alertQueue.length === 0) {
        return;
    }

    if (alertTimeout) {
        return;
    }

    const { avatar, message, colorString } = alertQueue.shift();
    document.getElementById("alert-msg").innerHTML = message;
    document.getElementById("alert-img").src = avatar;
    document.getElementById('podium-alert').style.boxShadow = `0 0 30px ${colorString}`;
    document.getElementById("podium-alerts").style.bottom = '0';


    alertTimeout = setTimeout(() => {
        document.getElementById("podium-alerts").style.bottom = '-200px';
        alertTimeout = null;

        setTimeout(() => {
            processAlertQueue();
        }, 1000);
    }, 3500);
}

function populateFinalLeaderboard() {
    sortPlayersByPoints();

    const topPlayers = playersData.slice(0, Math.min(5, playersData.length));

    topPlayers.forEach((player, index) => {
        const placeId = `place${index + 1}-final`;
        const leaderboardPlace = document.getElementById(placeId);
        if (leaderboardPlace) {
            let profileImagePath = player.profile_image ? player.profile_image.replace(/\\/g, '/') : '/img/player.png';
            if (!profileImagePath.startsWith('/')) {
                profileImagePath = `/${profileImagePath}`;
            }

            leaderboardPlace.innerHTML = `
                <div class="leaderboard-final-placement-wrap">
                    <img src="${profileImagePath}" alt="${player.username}'s profile picture">
                    <div class="leaderboard-final-info">
                        <p class="final-place">${ordinalSuffixOf(index + 1)}</p>
                        <p class="final-name">${player.username}</p>
                        <p class="final-points">${player.points} pts</p>
                    </div>
                </div>`;
        }
    });
}

function endGame() {
    document.getElementById('podium-guessed-by').style.opacity = '0';
    document.getElementById('podium-display-wrap').style.opacity = '0';
    populateFinalLeaderboard();

    setTimeout(() => {
        document.getElementById('podium-final-leaderboard').style.opacity = '1';
    }, 1000);
}

function alertPositiveBonus(playerID, pts){
    const player = playersData.find(player => player.id === playerID);
    if(player !== undefined){
        player.points += pts;
        let profileImagePath = player.profile_image ? player.profile_image.replace(/\\/g, '/') : '/img/player.png';
        if (!profileImagePath.startsWith('/')) {
            profileImagePath = `/${profileImagePath}`;
        }

        pushAlert(profileImagePath, player.username + " received bonus points! (+" + pts + ")", "green");
    }
}

function alertNegativeBonus(playerID, pts){
    const player = playersData.find(player => player.id === playerID);
    if(player !== undefined){
        player.points -= pts;
        let profileImagePath = player.profile_image ? player.profile_image.replace(/\\/g, '/') : '/img/player.png';
        if (!profileImagePath.startsWith('/')) {
            profileImagePath = `/${profileImagePath}`;
        }

        pushAlert(profileImagePath, player.username + " received negative points! (-" + pts + ")", "red");
    }
}

function bonusPoints(trackURI, artistURI, albumURI){
    const example = playersData.find(player => player.id === 1);

    if(trackURI === "spotify:track:0BxE4FqsDD1Ot4YuBXwAPp"){
        if (example) {
            alertPositiveBonus(example.id, 3);
        }
    }
}
