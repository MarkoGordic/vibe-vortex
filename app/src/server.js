const path = require('path');
const http = require('http');
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { db } = require('./database');
const appRoutes = require('./routes/app');
const spotifyRoutes = require('./routes/spotify');
const createVortexRoutes = require('./routes/vortex');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 1337;
const SESSION_SECRET = process.env.SESSION_SECRET || 'vibe-vortex-session-secret';
const ADMIN_CONFIG = {
    username: process.env.ADMIN_USERNAME,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD
};

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public'), {
    etag: true,
    maxAge: '1d'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax'
    }
}));

app.use('/spotify', cors(), spotifyRoutes);
app.use('/api', cors(), appRoutes);
app.use('/vortex', cors(), createVortexRoutes(io));
app.use('/admin', adminRoutes);

app.get('/', (req, res) => {
    const spotifyId = req.session && req.session.spotify_id ? req.session.spotify_id : null;
    const userID = req.session && req.session.userId ? req.session.userId : null;

    if (userID !== null && spotifyId !== null) {
        res.redirect('/vortex/setup');
    } else {
        res.render('index', { spotify_id: spotifyId, userID: userID });
    }
});

// Track connected players per room
const roomPlayers = new Map();
// Track if game has started for each room
const gameStarted = new Map();

io.on('connection', (socket) => {
    console.log('[DEBUG] : socket.IO -> A client connected.');

    // Handle player joining a room
    socket.on('join_room', async (data) => {
        const { roomCode, userId, username, profileImage, isHost } = data;
        
        // Join the socket room
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.userId = userId;
        socket.username = username;
        socket.profileImage = profileImage;
        socket.isHost = isHost;
        
        // Initialize room tracking if needed
        if (!roomPlayers.has(roomCode)) {
            roomPlayers.set(roomCode, new Map());
        }
        
        const players = roomPlayers.get(roomCode);
        const wasAlreadyConnected = players.has(userId);
        
        // Add/update player in room
        players.set(userId, {
            odId: userId,
            userId: userId,
            username: username,
            profileImage: profileImage,
            socketId: socket.id,
            isHost: isHost
        });
        
        console.log(`[DEBUG] : Player ${username} (${userId}) joined room ${roomCode}`);
        
        // Notify others in the room that a new player joined (only if not already connected)
        if (!wasAlreadyConnected && !isHost) {
            socket.to(roomCode).emit('player_connected', {
                userId: userId,
                username: username,
                profileImage: profileImage,
                isHost: isHost
            });
        }
        
        // Send current game state to late joiners - if game already started, tell them
        const isGameStarted = gameStarted.get(roomCode) || false;
        socket.emit('room_joined', {
            success: true,
            playerCount: players.size,
            gameStarted: isGameStarted
        });
    });

    socket.on('message', (data) => {
        console.log('Received message from client:', data);
        if (socket.roomCode) {
            io.to(socket.roomCode).emit('message', data);
        } else {
            io.emit('message', data);
        }
    });

    socket.on('server_command', (data) => {
        console.log('Received message from client:', data);
        
        // Track when game starts
        if (data === 'game_ready' && socket.roomCode) {
            gameStarted.set(socket.roomCode, true);
        }
        
        if (socket.roomCode) {
            io.to(socket.roomCode).emit('server_command', data);
        } else {
            io.emit('server_command', data);
        }
    });

    socket.on('host_command', (data) => {
        console.log('Received message from client:', data);
        if (socket.roomCode) {
            io.to(socket.roomCode).emit('host_command', data);
        } else {
            io.emit('host_command', data);
        }
    });

    socket.on('player_action', (data) => {
        console.log('Received message from client:', data);
        if (socket.roomCode) {
            io.to(socket.roomCode).emit('player_action', data);
        } else {
            io.emit('player_action', data);
        }
    });

    socket.on('disconnect', () => {
        console.log('[DEBUG] : socket.IO -> A client disconnected.');
        
        // Handle player leaving room
        if (socket.roomCode && socket.userId) {
            const roomCode = socket.roomCode;
            const players = roomPlayers.get(roomCode);
            
            if (players) {
                const player = players.get(socket.userId);
                
                // Only remove if this socket is the current one for this user
                if (player && player.socketId === socket.id) {
                    players.delete(socket.userId);
                    
                    console.log(`[DEBUG] : Player ${socket.username} (${socket.userId}) left room ${roomCode}`);
                    
                    // Notify others in the room
                    if (!socket.isHost) {
                        socket.to(roomCode).emit('player_disconnected', {
                            userId: socket.userId,
                            username: socket.username,
                            profileImage: socket.profileImage
                        });
                    }
                }
                
                // Clean up empty rooms
                if (players.size === 0) {
                    roomPlayers.delete(roomCode);
                }
            }
        }
    });
});

async function start() {
    try {
        await db.migrate();
        await db.ensureAdminAccount(ADMIN_CONFIG);
        server.listen(PORT, () => {
            console.log(`[DEBUG] : Vibe Vortex is now listening on port ${PORT}`);
        });
    } catch (error) {
        console.error('[ERROR] : Failed to start server', error);
        process.exit(1);
    }
}

start();
