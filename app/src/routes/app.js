const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const multer = require('multer');
const { db } = require('../database');

const router = express.Router();
const uploadPath = path.join(__dirname, '..', 'public', 'uploads');
fs.mkdirSync(uploadPath, { recursive: true });

const storage = multer.diskStorage({
    destination: uploadPath,
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        cb(null, safeName);
    }
});

const upload = multer({ storage });

router.post('/register', upload.single('profilePicture'), async (req, res) => {
    const { username, email, password } = req.body;
    const profileImagePath = req.file ? `uploads/${req.file.filename}` : null;

    try {
        const usernameExists = await db.usernameExists(username);
        const emailExists = await db.emailExists(email);

        if (usernameExists) {
            console.log(`[ERROR] : Registration attempt for username ${username} failed. User already exists.`);
            return res.redirect('/?error=user_exist');
        }

        if (emailExists) {
            console.log(`[ERROR] : Registration attempt for username ${username} failed. Email already exists.`);
            return res.redirect('/?error=email_exist');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = { username, email, password: hashedPassword };
        await db.registerNewAccount(user, profileImagePath);
        console.log(`[INFO] : Registration attempt for username ${username} completed.`);
        return res.redirect('/?info=register_complete');
    } catch (error) {
        console.error('[ERROR] : Error during registration', error);
        return res.redirect('/?error=registration_error');
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await db.getUserByEmail(email);
        if (!user) {
            console.log('[ERROR] : Login attempt failed. User not found.');
            return res.redirect('/?error=user_not_found');
        }

        const match = await bcrypt.compare(password, user.password);
        if (match) {
            req.session.userId = user.id;
            req.session.spotify_id = user.spotify_id;

            console.log(`[INFO] : Login successful for username ${user.username}.`);
            if (user.spotify_id === null) {
                return res.redirect('/');
            }
            return res.redirect('/spotify/code');
        }

        console.log('[ERROR] : Login attempt failed. Incorrect password.');
        return res.redirect('/?error=incorrect_password');
    } catch (error) {
        console.error('[ERROR] : Error during login:', error);
        return res.redirect('/?error=login_error');
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('[ERROR] : Error clearing session during logout:', err);
            return res.status(500).send('Error logging out');
        }

        res.clearCookie('connect.sid');
        return res.redirect('/');
    });
});

module.exports = router;
