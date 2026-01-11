const SpotifyWebApi = require('spotify-web-api-node');

const spotifyConfig = {
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || ''
};

class SpotifyClient {
    constructor(accessToken) {
        this.SpotifyAPI = new SpotifyWebApi(spotifyConfig);
        if (accessToken) {
            this.SpotifyAPI.setAccessToken(accessToken);
        }
    }

    async getUserInfo() {
        const me = await this.SpotifyAPI.getMe();
        return { id: me.body.id, product: me.body.product === 'premium' };
    }

    async playTrack(uri, res) {
        try {
            await this.SpotifyAPI.play({ uris: [uri] });
            res.send('Track is now playing.');
        } catch (error) {
            console.error('Error playing track:', error);
            res.send('An error occurred while playing the track.');
        }
    }

    async getUserPlaylists(userId) {
        return this.SpotifyAPI.getUserPlaylists(userId);
    }

    async getUserDevices() {
        return this.SpotifyAPI.getMyDevices();
    }

    async getPlaylistTracks(playlistId) {
        let tracks = [];
        let totalTracks = 0;
        let offset = 0;
        const limit = 50;

        try {
            const playlistData = await this.SpotifyAPI.getPlaylist(playlistId);
            totalTracks = playlistData.body.tracks.total;

            while (offset < totalTracks) {
                const fetchLimit = Math.min(limit, totalTracks - offset);
                const trackData = await this.SpotifyAPI.getPlaylistTracks(playlistId, {
                    offset,
                    limit: fetchLimit,
                    fields: 'items'
                });

                tracks = tracks.concat(trackData.body.items);
                offset += fetchLimit;
            }

            console.log('[GAME] : Playlist loaded! Total tracks loaded:', tracks.length);
            return tracks;
        } catch (error) {
            console.error('Error fetching tracks from playlist:', error);
            return [];
        }
    }
}

module.exports = { SpotifyClient, spotifyConfig };
