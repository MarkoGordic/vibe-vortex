const express = require('express');
const querystring = require('querystring');
const { SpotifyClient, spotifyConfig } = require('../spotify');
const { db } = require('../database');

const router = express.Router();

const encodeFormData = (data) => {
    return Object.keys(data)
        .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
        .join('&');
};

function isAuthorized(req, res, next) {
    if (req.session.userId !== undefined) {
        next();
    } else {
        res.redirect('/');
    }
}

router.get('/code', isAuthorized, async (req, res) => {
    const scope = `
        user-modify-playback-state
        user-read-playback-state
        user-read-currently-playing
        user-library-modify
        user-modify-playback-state
        user-library-read
        user-top-read
        user-read-private
        playlist-read-private
        playlist-modify-public
    `;

    res.redirect(
        'https://accounts.spotify.com/authorize?' +
            querystring.stringify({
                response_type: 'code',
                client_id: spotifyConfig.clientId,
                scope: scope,
                redirect_uri: spotifyConfig.redirectUri
            })
    );
});

router.get('/authorize', isAuthorized, async (req, res) => {
    if (req.query.code === undefined) {
        return res.send('Failed to obtain access code.');
    }

    const body = {
        grant_type: 'authorization_code',
        code: req.query.code,
        redirect_uri: spotifyConfig.redirectUri,
        client_id: spotifyConfig.clientId,
        client_secret: spotifyConfig.clientSecret
    };

    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json'
            },
            body: encodeFormData(body)
        });

        const data = await response.json();
        if (data.access_token === undefined || data.refresh_token === undefined) {
            return res.send('Failed to obtain access/refresh token');
        }

        req.session.access_token = data.access_token;
        req.session.refresh_token = data.refresh_token;
        console.log('[DEBUG] : Spotify access token updated successfully!');

        const spotifyClient = new SpotifyClient(req.session.access_token);
        const userInfo = await spotifyClient.getUserInfo();

        req.session.spotify_id = userInfo.id;
        req.session.premium = userInfo.product;

        await db.updateSpotifyId(req.session.userId, userInfo.id);
        console.log('[INFO] : Spotify user ID updated in database for userId: ', req.session.userId);

        return res.redirect('/vortex/setup');
    } catch (error) {
        console.error('[ERROR] : Failed to authorize Spotify user:', error);
        return res.status(500).send('Internal Server Error: Unable to authorize Spotify user.');
    }
});

router.get('/play', isAuthorized, async (req, res) => {
    const uri = req.query.uri;
    const client = new SpotifyClient(req.session.access_token);
    await client.playTrack(uri, res);
});

router.get('/my_playlists', isAuthorized, async (req, res) => {
    try {
        const client = new SpotifyClient(req.session.access_token);
        const playlists = await client.getUserPlaylists(req.session.spotify_id);
        res.json(playlists.body.items);
    } catch (error) {
        console.error('Failed to get playlists:', error);
        res.status(500).json({ error: 'Failed to get playlists' });
    }
});

router.post('/aggregate_playlists', isAuthorized, async (req, res) => {
    const playlistIds = req.body.playlistIds;
    if (!playlistIds || !Array.isArray(playlistIds)) {
        return res.status(400).json({ error: 'Invalid playlist IDs' });
    }

    try {
        const client = new SpotifyClient(req.session.access_token);
        let allTracks = [];

        for (const playlistId of playlistIds) {
            const tracks = await client.getPlaylistTracks(playlistId);
            allTracks = allTracks.concat(tracks);
        }

        console.log(`[INFO] : Fetched ${allTracks.length} tracks from playlists`);
        res.json(allTracks);
    } catch (error) {
        console.error('Failed to fetch tracks from playlists:', error);
        res.status(500).json({ error: 'Failed to fetch tracks from playlists' });
    }
});

router.get('/devices', isAuthorized, async (req, res) => {
    try {
        const client = new SpotifyClient(req.session.access_token);
        const devices = await client.getUserDevices();
        res.json(devices.body.devices);
    } catch (error) {
        console.error('Failed to get devices:', error);
        res.status(500).json({ error: 'Failed to get devices' });
    }
});

module.exports = router;
