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

app.get('/', (req, res) => {
    const spotifyId = req.session && req.session.spotify_id ? req.session.spotify_id : null;
    const userID = req.session && req.session.userId ? req.session.userId : null;

    if (userID !== null && spotifyId !== null) {
        res.redirect('/vortex/setup');
    } else {
        res.render('index', { spotify_id: spotifyId, userID: userID });
    }
});

io.on('connection', (socket) => {
    console.log('[DEBUG] : socket.IO -> A client connected.');

    socket.on('message', (data) => {
        console.log('Received message from client:', data);
        io.emit('message', data);
    });

    socket.on('server_command', (data) => {
        console.log('Received message from client:', data);
        io.emit('server_command', data);
    });

    socket.on('host_command', (data) => {
        console.log('Received message from client:', data);
        io.emit('host_command', data);
    });

    socket.on('player_action', (data) => {
        console.log('Received message from client:', data);
        io.emit('player_action', data);
    });

    socket.on('disconnect', () => {
        console.log('[DEBUG] : socket.IO -> A client disconnected.');
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
