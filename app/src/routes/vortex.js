const express = require('express');
const { db } = require('../database');

function createVortexRoutes(io) {
    const router = express.Router();

    function isAuthorized(req, res, next) {
        if (req.session.userId !== undefined) {
            next();
        } else {
            res.redirect('/');
        }
    }

    function isPremium(req, res, next) {
        if (req.session.premium === true) {
            next();
        } else {
            res.redirect('/vortex/setup');
        }
    }

    function isHost(req, res, next) {
        if (req.session.host !== undefined) {
            next();
        } else {
            res.redirect('/vortex/setup');
        }
    }

    async function redirectIfInActiveRoom(req, res, next) {
        const userId = req.session.userId;

        try {
            const currentRoom = await db.findPlayerInActiveRooms(userId);
            if (currentRoom.isInRoom) {
                if (currentRoom.isHost && !currentRoom.started) {
                    req.session.host = currentRoom.roomCode;
                    return res.redirect('/vortex/configure');
                }

                if (currentRoom.isHost && currentRoom.started) {
                    req.session.host = currentRoom.roomCode;
                    return res.redirect(`/vortex/room/${currentRoom.roomCode}`);
                }

                return res.redirect(`/vortex/room/${currentRoom.roomCode}`);
            }

            return next();
        } catch (error) {
            console.error('Error checking active rooms:', error);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }

    router.get('/me', isAuthorized, (req, res) => {
        if (req.session.userId) {
            res.json({ userId: req.session.userId });
        } else {
            res.status(401).json({ error: 'User not authenticated' });
        }
    });

    router.get('/setup', isAuthorized, redirectIfInActiveRoom, async (req, res) => {
        try {
            const isAdmin = await db.isUserAdmin(req.session.userId);
            req.session.isAdmin = isAdmin;
            res.render('setup', { isPremium: req.session.premium, isAdmin });
        } catch (error) {
            console.error('Error checking admin status:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    });

    router.get('/new', isAuthorized, isPremium, redirectIfInActiveRoom, async (req, res) => {
        try {
            const roomCode = await db.generateUniqueRoomCode();
            req.session.host = roomCode;

            await db.createNewRoom(req.session.userId, roomCode);
            res.redirect('/vortex/configure');
        } catch (error) {
            console.error('Error creating new room:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    });

    router.get('/configure', isAuthorized, isPremium, isHost, async (req, res) => {
        res.render('configure', { roomCode: req.session.host });
    });

    router.post('/configure/save', isAuthorized, isPremium, isHost, async (req, res) => {
        const roomKey = req.session.host;
        const configuration = req.body;

        try {
            const saveResult = await db.saveGameConfiguration(roomKey, configuration);
            if (saveResult) {
                res.json({ success: true, message: 'Configuration saved successfully' });
            } else {
                res.status(404).json({ success: false, message: 'Room not found' });
            }
        } catch (error) {
            console.error('Error saving game configuration:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    });

    router.get('/join/:roomCode', isAuthorized, async (req, res) => {
        const roomCode = req.params.roomCode;
        const userId = req.session.userId;

        try {
            const currentRoom = await db.findPlayerInActiveRooms(userId);
            if (currentRoom.isInRoom && currentRoom.roomCode !== roomCode) {
                res.redirect(`/vortex/room/${currentRoom.roomCode}`);
                return;
            }

            const roomExists = await db.checkRoomExistsAndActive(roomCode);
            if (!roomExists) {
                res.redirect('/vortex/setup');
                return;
            }

            const joinResult = await db.playerJoin(roomCode, userId);
            if (joinResult === 1) {
                io.emit('player_joined', { userId: userId, roomCode: roomCode });
                res.redirect(`/vortex/room/${roomCode}`);
            } else {
                res.status(400).send('Unable to join the room.');
            }
        } catch (error) {
            console.error('Error joining room:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    });

    router.get('/room/leave', isAuthorized, async (req, res) => {
        const userId = req.session.userId;

        try {
            const currentRoom = await db.findPlayerInActiveRooms(userId);
            if (currentRoom.isInRoom) {
                const isHost = await db.isRoomHost(currentRoom.roomCode, userId);

                if (isHost) {
                    res.redirect(`/vortex/room/${currentRoom.roomCode}`);
                } else {
                    const leaveResult = await db.playerLeave(currentRoom.roomCode, userId);
                    if (leaveResult === 1) {
                        res.redirect('/vortex/setup');
                    } else {
                        res.status(404).json({ success: false, message: 'Player not in room' });
                    }
                }
            } else {
                res.status(400).json({ success: false, message: 'Not in any active room' });
            }
        } catch (error) {
            console.error('Error leaving room:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    });

    router.get('/room/:roomCode', isAuthorized, async (req, res) => {
        const userId = req.session.userId;
        const roomCode = req.params.roomCode;

        try {
            const players = await db.getCurrentPlayers(roomCode);

            if (!players.includes(userId)) {
                res.redirect('/vortex/setup');
                return;
            }

            const isHostUser = await db.isRoomHost(roomCode, userId);
            res.render('room', { host: isHostUser });
        } catch (error) {
            console.error('Error checking room and host status:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    });

    router.get('/podium', isAuthorized, isHost, isPremium, async (req, res) => {
        const roomCode = req.session.host;

        try {
            const isActive = await db.isGameActive(roomCode);

            if (isActive) {
                res.render('game', { roomCode });
            } else {
                res.redirect('/vortex/setup');
            }
        } catch (error) {
            console.error('Error checking game status:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    });

    router.post('/deactivate_room', isAuthorized, async (req, res) => {
        const { roomCode } = req.body;
        const userId = req.session.userId;

        if (!roomCode) {
            return res.status(400).json({ success: false, message: 'Room code is required' });
        }

        try {
            const isHostUser = await db.isRoomHost(roomCode, userId);
            if (!isHostUser) {
                return res
                    .status(403)
                    .json({ success: false, message: 'Only the room host can deactivate the room' });
            }

            const deactivationResult = await db.deactivateRoom(roomCode);
            if (deactivationResult) {
                res.json({ success: true, message: 'Room deactivated successfully' });
            } else {
                res.status(404).json({ success: false, message: 'Room not found' });
            }
        } catch (error) {
            console.error('Error deactivating room:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    });

    router.post('/users', isAuthorized, async (req, res) => {
        const { userIds } = req.body;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ success: false, message: 'User IDs are required' });
        }

        try {
            const usersInfo = await db.getUsersInfoByIds(userIds);
            if (usersInfo.length > 0) {
                res.json(usersInfo);
            } else {
                res.status(404).json({ success: false, message: 'Users not found' });
            }
        } catch (error) {
            console.error('Error getting users info:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    });

    router.post('/room/players', isAuthorized, async (req, res) => {
        const { roomCode } = req.body;

        try {
            const players = await db.getCurrentPlayers(roomCode);
            res.json(players);
        } catch (error) {
            console.error('Error getting players:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    });

    router.get('/room/preferences/:roomCode', isAuthorized, async (req, res) => {
        const roomCode = req.params.roomCode;

        try {
            const gamePreferences = await db.getGamePreferences(roomCode);
            if (gamePreferences) {
                res.json(gamePreferences);
            } else {
                res
                    .status(404)
                    .json({ success: false, message: 'Game preferences not found for the given room code.' });
            }
        } catch (error) {
            console.error('Error fetching game preferences:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    });

    // Public API for lobby lines (used by players waiting in lobby)
    router.get('/lobby-line', isAuthorized, async (req, res) => {
        try {
            const line = await db.getRandomLobbyLine();
            res.json({ success: true, line });
        } catch (error) {
            console.error('Error fetching lobby line:', error);
            res.status(500).json({ success: false, message: 'Internal server error' });
        }
    });

    return router;
}

module.exports = createVortexRoutes;
