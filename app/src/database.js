const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'vibe_vortex',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

class Database {
    async migrate() {
        console.info('[INFO] : Database migration started.');

        const createUsersTable = `
            CREATE TABLE IF NOT EXISTS users (
                id              INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
                username        VARCHAR(32) NOT NULL UNIQUE,
                password        VARCHAR(100) NOT NULL,
                email           VARCHAR(100) NOT NULL,
                profile_image   VARCHAR(255),
                spotify_id      VARCHAR(50),
                last_login_ip   VARCHAR(15),
                admin           TINYINT
            );
        `;

        const createGamesTable = `
            CREATE TABLE IF NOT EXISTS games (
                game_id     INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
                room_key    VARCHAR(7),
                host_id     INT,
                winner_id   INT,
                players     TEXT,
                active      INT,
                started     BOOLEAN DEFAULT FALSE,
                game_type   VARCHAR(50),
                playlists   TEXT,
                track_limit INT,
                device_id   VARCHAR(50),
                preferences TEXT
            );
        `;

        await pool.execute(createUsersTable);
        await pool.execute(createGamesTable);
        console.info('[INFO] : Database migration completed.');
    }

    async usernameExists(username) {
        const [rows] = await pool.query('SELECT 1 FROM users WHERE username = ? LIMIT 1', [username]);
        return rows.length > 0;
    }

    async emailExists(email) {
        const [rows] = await pool.query('SELECT 1 FROM users WHERE email = ? LIMIT 1', [email]);
        return rows.length > 0;
    }

    async registerNewAccount(user, profileImagePath) {
        const { username, password, email } = user;
        await pool.query(
            'INSERT INTO users (username, password, email, admin, profile_image) VALUES (?, ?, ?, ?, ?)',
            [username, password, email, false, profileImagePath]
        );
        return 1;
    }

    async getUserByEmail(email) {
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
        return rows.length > 0 ? rows[0] : null;
    }

    async getUsersInfoByIds(userIds) {
        if (!userIds || userIds.length === 0) {
            return [];
        }
        const [rows] = await pool.query('SELECT id, username, profile_image FROM users WHERE id IN (?)', [userIds]);
        return rows;
    }

    async updateSpotifyId(id, spotifyId) {
        const [result] = await pool.query('UPDATE users SET spotify_id = ? WHERE id = ?', [spotifyId, id]);
        return result.affectedRows > 0;
    }

    async generateUniqueRoomCode() {
        let unique = false;
        let roomCode;

        while (!unique) {
            roomCode = Math.floor(1000000 + Math.random() * 9000000).toString();
            const [rows] = await pool.query('SELECT 1 FROM games WHERE room_key = ? AND active = 1 LIMIT 1', [roomCode]);
            if (rows.length === 0) {
                unique = true;
            }
        }

        return roomCode;
    }

    async isRoomHost(roomCode, userId) {
        const [rows] = await pool.query('SELECT host_id FROM games WHERE room_key = ? LIMIT 1', [roomCode]);
        return rows.length > 0 && rows[0].host_id === userId;
    }

    async isGameActive(roomCode) {
        const [rows] = await pool.query('SELECT active FROM games WHERE room_key = ? LIMIT 1', [roomCode]);
        return rows.length > 0 && rows[0].active === 1;
    }

    async createNewRoom(hostId, roomCode) {
        const players = JSON.stringify([hostId]);
        await pool.query(
            'INSERT INTO games (room_key, host_id, players, active, started) VALUES (?, ?, ?, 1, false)',
            [roomCode, hostId, players]
        );
        return 1;
    }

    async deactivateRoom(roomCode) {
        const [result] = await pool.query('UPDATE games SET active = 0 WHERE room_key = ?', [roomCode]);
        return result.affectedRows > 0;
    }

    async saveGameConfiguration(roomKey, configuration) {
        const { game_type, playlists, track_limit, device_id, preferences } = configuration;
        const playlistsJson = JSON.stringify(playlists || []);
        const preferencesJson = JSON.stringify(preferences || {});

        const [result] = await pool.query(
            `
                UPDATE games
                SET game_type = ?, playlists = ?, track_limit = ?, device_id = ?, preferences = ?, started = 1
                WHERE room_key = ?
            `,
            [game_type, playlistsJson, track_limit, device_id, preferencesJson, roomKey]
        );

        return result.affectedRows > 0;
    }

    async getGamePreferences(roomKey) {
        const [rows] = await pool.query(
            'SELECT game_type, playlists, track_limit, device_id, preferences FROM games WHERE room_key = ? LIMIT 1',
            [roomKey]
        );

        if (rows.length === 0) {
            return null;
        }

        const gamePrefs = rows[0];
        try {
            gamePrefs.playlists = gamePrefs.playlists ? JSON.parse(gamePrefs.playlists) : [];
        } catch (error) {
            gamePrefs.playlists = [];
        }

        try {
            gamePrefs.preferences = gamePrefs.preferences ? JSON.parse(gamePrefs.preferences) : {};
        } catch (error) {
            gamePrefs.preferences = {};
        }

        return gamePrefs;
    }

    async checkRoomExistsAndActive(roomCode) {
        const [rows] = await pool.query('SELECT 1 FROM games WHERE room_key = ? AND active = 1 LIMIT 1', [roomCode]);
        return rows.length > 0;
    }

    async playerJoin(roomCode, playerId) {
        const [rows] = await pool.query('SELECT players FROM games WHERE room_key = ? LIMIT 1', [roomCode]);
        let players = [];
        if (rows.length > 0 && rows[0].players) {
            try {
                players = JSON.parse(rows[0].players) || [];
            } catch (error) {
                players = [];
            }
        }

        if (!players.includes(playerId)) {
            players.push(playerId);
            await pool.query('UPDATE games SET players = ? WHERE room_key = ?', [JSON.stringify(players), roomCode]);
            return 1;
        }

        return 0;
    }

    async playerLeave(roomCode, playerId) {
        const [rows] = await pool.query('SELECT players FROM games WHERE room_key = ? LIMIT 1', [roomCode]);
        let players = [];

        if (rows.length > 0 && rows[0].players) {
            try {
                players = JSON.parse(rows[0].players) || [];
            } catch (error) {
                players = [];
            }
        }

        const playerIndex = players.indexOf(playerId);
        if (playerIndex > -1) {
            players.splice(playerIndex, 1);
            await pool.query('UPDATE games SET players = ? WHERE room_key = ?', [JSON.stringify(players), roomCode]);
            return 1;
        }

        return 0;
    }

    async findPlayerInActiveRooms(playerId) {
        const [rooms] = await pool.query('SELECT room_key, players, host_id, active, started FROM games WHERE active = 1');

        for (const room of rooms) {
            let players = [];
            if (room.players) {
                try {
                    players = JSON.parse(room.players) || [];
                } catch (error) {
                    players = [];
                }
            }

            if (players.includes(playerId)) {
                return {
                    isInRoom: true,
                    roomCode: room.room_key,
                    isHost: room.host_id === playerId,
                    started: room.started
                };
            }
        }

        return { isInRoom: false };
    }

    async getCurrentPlayers(roomCode) {
        const [rows] = await pool.query('SELECT players FROM games WHERE room_key = ? LIMIT 1', [roomCode]);
        if (rows.length > 0 && rows[0].players) {
            try {
                return JSON.parse(rows[0].players) || [];
            } catch (error) {
                return [];
            }
        }

        return [];
    }
}

const db = new Database();

module.exports = { db, pool };
