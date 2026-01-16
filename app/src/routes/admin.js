const express = require('express');
const bcrypt = require('bcrypt');
const { db } = require('../database');

const router = express.Router();

async function requireAdminPage(req, res, next) {
    if (!req.session.userId) {
        return res.redirect('/');
    }

    try {
        const isAdmin = await db.isUserAdmin(req.session.userId);
        if (!isAdmin) {
            return res.redirect('/vortex/setup');
        }
        req.session.isAdmin = true;
        return next();
    } catch (error) {
        console.error('[ERROR] : Admin auth failed', error);
        return res.status(500).send('Internal Server Error');
    }
}

async function requireAdminApi(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    try {
        const isAdmin = await db.isUserAdmin(req.session.userId);
        if (!isAdmin) {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }
        req.session.isAdmin = true;
        return next();
    } catch (error) {
        console.error('[ERROR] : Admin auth failed', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

router.get('/', requireAdminPage, (req, res) => {
    res.render('admin', { currentUserId: req.session.userId });
});

router.get('/users', requireAdminApi, async (req, res) => {
    const rawLimit = Number.parseInt(req.query.limit, 10);
    const rawOffset = Number.parseInt(req.query.offset, 10);
    const limit = Number.isNaN(rawLimit) ? 20 : Math.min(Math.max(rawLimit, 5), 100);
    const offset = Number.isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0);
    const search = typeof req.query.search === 'string' ? req.query.search : '';

    try {
        const [listResult, stats] = await Promise.all([
            db.listUsers({ search, limit, offset }),
            db.getUserStats()
        ]);

        res.json({
            success: true,
            users: listResult.users,
            total: listResult.total,
            stats
        });
    } catch (error) {
        console.error('[ERROR] : Failed to list users', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

router.patch('/users/:id', requireAdminApi, async (req, res) => {
    const userId = Number.parseInt(req.params.id, 10);
    const { admin } = req.body;

    if (!Number.isInteger(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    if (typeof admin !== 'boolean') {
        return res.status(400).json({ success: false, message: 'Admin flag is required' });
    }

    if (userId === req.session.userId && admin === false) {
        return res.status(400).json({ success: false, message: 'You cannot remove your own admin access' });
    }

    try {
        const targetUser = await db.getUserById(userId);
        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (Boolean(targetUser.admin) && admin === false) {
            const adminCount = await db.countAdmins();
            if (adminCount <= 1) {
                return res.status(400).json({ success: false, message: 'At least one admin account is required' });
            }
        }

        const updated = await db.updateUserAdmin(userId, admin);
        if (!updated) {
            return res.status(500).json({ success: false, message: 'Failed to update user' });
        }

        return res.json({ success: true });
    } catch (error) {
        console.error('[ERROR] : Failed to update admin status', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

router.post('/users/:id/password', requireAdminApi, async (req, res) => {
    const userId = Number.parseInt(req.params.id, 10);
    const { password } = req.body;

    if (!Number.isInteger(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    if (typeof password !== 'string' || password.trim().length < 8) {
        return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    try {
        const targetUser = await db.getUserById(userId);
        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const updated = await db.updateUserPassword(userId, hashedPassword);
        if (!updated) {
            return res.status(500).json({ success: false, message: 'Failed to update password' });
        }

        return res.json({ success: true });
    } catch (error) {
        console.error('[ERROR] : Failed to reset password', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

router.delete('/users/:id', requireAdminApi, async (req, res) => {
    const userId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    if (userId === req.session.userId) {
        return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }

    try {
        const targetUser = await db.getUserById(userId);
        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (Boolean(targetUser.admin)) {
            const adminCount = await db.countAdmins();
            if (adminCount <= 1) {
                return res.status(400).json({ success: false, message: 'At least one admin account is required' });
            }
        }

        const deleted = await db.deleteUser(userId);
        if (!deleted) {
            return res.status(500).json({ success: false, message: 'Failed to delete user' });
        }

        return res.json({ success: true });
    } catch (error) {
        console.error('[ERROR] : Failed to delete user', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Settings Routes
router.get('/settings/lobby-lines', requireAdminApi, async (req, res) => {
    try {
        const lines = await db.getLobbyLines();
        res.json({ success: true, lines });
    } catch (error) {
        console.error('[ERROR] : Failed to fetch lobby lines', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

router.put('/settings/lobby-lines', requireAdminApi, async (req, res) => {
    const { lines } = req.body;

    if (!Array.isArray(lines)) {
        return res.status(400).json({ success: false, message: 'Lines must be an array' });
    }

    if (lines.length > 1000) {
        return res.status(400).json({ success: false, message: 'Maximum 1000 lines allowed' });
    }

    const invalidLines = lines.some(line => typeof line !== 'string');
    if (invalidLines) {
        return res.status(400).json({ success: false, message: 'All lines must be strings' });
    }

    try {
        await db.setLobbyLines(lines);
        res.json({ success: true });
    } catch (error) {
        console.error('[ERROR] : Failed to save lobby lines', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

module.exports = router;
