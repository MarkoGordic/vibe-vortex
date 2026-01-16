const adminContext = window.ADMIN_CONTEXT || {};
const currentUserId = Number(adminContext.currentUserId);
const state = {
    search: '',
    limit: 20,
    offset: 0,
    total: 0,
    stats: { total: 0, admins: 0, spotify_linked: 0 },
    users: [],
    activeUserId: null,
    activeUsername: '',
    lobbyLines: [],
    lobbyLinesChanged: false
};

const elements = {
    userRows: document.getElementById('userRows'),
    resultCount: document.getElementById('resultCount'),
    pageInfo: document.getElementById('pageInfo'),
    prevPage: document.getElementById('prevPage'),
    nextPage: document.getElementById('nextPage'),
    searchInput: document.getElementById('searchInput'),
    refreshButton: document.getElementById('refreshButton'),
    pageSize: document.getElementById('pageSize'),
    statTotal: document.getElementById('stat-total'),
    statAdmins: document.getElementById('stat-admins'),
    statSpotify: document.getElementById('stat-spotify'),
    modal: document.getElementById('passwordModal'),
    modalUser: document.getElementById('modalUser'),
    newPassword: document.getElementById('newPassword'),
    savePassword: document.getElementById('savePassword'),
    cancelModal: document.getElementById('cancelModal'),
    closeModal: document.getElementById('closeModal'),
    toast: document.getElementById('toast'),
    // Tab elements
    tabButtons: document.querySelectorAll('.tab-button'),
    tabContents: document.querySelectorAll('.tab-content'),
    // Settings elements
    lobbyLinesList: document.getElementById('lobbyLinesList'),
    newLineInput: document.getElementById('newLineInput'),
    addLineButton: document.getElementById('addLineButton'),
    lineCount: document.getElementById('lineCount')
};

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showToast(message, type = 'success') {
    elements.toast.textContent = message;
    elements.toast.className = `toast show ${type}`;
    setTimeout(() => {
        elements.toast.className = 'toast';
    }, 2400);
}

function setLoading() {
    elements.userRows.innerHTML = `
        <tr>
            <td colspan="4" class="muted">Loading users...</td>
        </tr>
    `;
}

function renderStats() {
    elements.statTotal.textContent = state.stats.total ?? 0;
    elements.statAdmins.textContent = state.stats.admins ?? 0;
    elements.statSpotify.textContent = state.stats.spotify_linked ?? 0;
}

function renderUsers() {
    if (!state.users.length) {
        elements.userRows.innerHTML = `
            <tr>
                <td colspan="4" class="muted">No users found for this search.</td>
            </tr>
        `;
        elements.resultCount.textContent = '0 results';
        elements.pageInfo.textContent = 'Page 1';
        elements.prevPage.disabled = true;
        elements.nextPage.disabled = true;
        return;
    }

    const rows = state.users.map((user) => {
        const isAdmin = Boolean(user.admin);
        const isSelf = user.id === currentUserId;
        const avatar = user.profile_image ? `/${user.profile_image}` : '/img/player.png';
        const roleLabel = isAdmin ? 'Admin' : 'User';
        const spotifyLabel = user.spotify_id ? 'Linked' : 'Not linked';
        const toggleLabel = isAdmin ? 'Remove admin' : 'Make admin';

        return `
            <tr>
                <td>
                    <div class="user-cell">
                        <img class="avatar" src="${avatar}" alt="${escapeHtml(user.username)}">
                        <div class="user-meta">
                            <strong>${escapeHtml(user.username)}</strong>
                            <span>${escapeHtml(user.email)}</span>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="pill ${isAdmin ? 'pill-admin' : 'pill-user'}">${roleLabel}${isSelf ? ' (you)' : ''}</span>
                </td>
                <td>
                    <span class="pill ${user.spotify_id ? 'pill-live' : 'pill-muted'}">${spotifyLabel}</span>
                </td>
                <td>
                    <div class="row-actions">
                        <button
                            class="warning-button"
                            data-action="toggle-admin"
                            data-id="${user.id}"
                            data-admin="${isAdmin ? '1' : '0'}"
                            ${isSelf ? 'disabled' : ''}
                        >
                            ${toggleLabel}
                        </button>
                        <button class="ghost-button" data-action="reset-password" data-id="${user.id}" data-username="${escapeHtml(user.username)}">
                            Reset password
                        </button>
                        <button
                            class="danger-button"
                            data-action="delete"
                            data-id="${user.id}"
                            data-username="${escapeHtml(user.username)}"
                            ${isSelf ? 'disabled' : ''}
                        >
                            Delete
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    elements.userRows.innerHTML = rows;
    elements.resultCount.textContent = `${state.total} results`;

    const currentPage = Math.floor(state.offset / state.limit) + 1;
    const totalPages = Math.max(Math.ceil(state.total / state.limit), 1);
    elements.pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    elements.prevPage.disabled = state.offset === 0;
    elements.nextPage.disabled = state.offset + state.limit >= state.total;
}

async function fetchUsers() {
    setLoading();
    const params = new URLSearchParams({
        search: state.search,
        limit: state.limit,
        offset: state.offset
    });

    try {
        const response = await fetch(`/admin/users?${params.toString()}`);
        const payload = await response.json();

        if (!response.ok || !payload.success) {
            throw new Error(payload.message || 'Failed to fetch users');
        }

        state.users = payload.users || [];
        state.total = payload.total || 0;
        if (state.total > 0 && state.offset >= state.total) {
            state.offset = Math.max(state.total - state.limit, 0);
            return fetchUsers();
        }
        state.stats = payload.stats || state.stats;
        renderStats();
        renderUsers();
    } catch (error) {
        console.error(error);
        elements.userRows.innerHTML = `
            <tr>
                <td colspan="4" class="muted">Failed to load users. Try again.</td>
            </tr>
        `;
        showToast('Failed to load users', 'error');
    }
}

async function toggleAdmin(userId, makeAdmin) {
    try {
        const response = await fetch(`/admin/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin: makeAdmin })
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
            throw new Error(payload.message || 'Failed to update user');
        }
        showToast('Role updated');
        fetchUsers();
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Failed to update user', 'error');
    }
}

async function deleteUser(userId, username) {
    const confirmed = window.confirm(`Delete ${username}? This cannot be undone.`);
    if (!confirmed) {
        return;
    }
    try {
        const response = await fetch(`/admin/users/${userId}`, { method: 'DELETE' });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
            throw new Error(payload.message || 'Failed to delete user');
        }
        showToast('User deleted');
        fetchUsers();
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Failed to delete user', 'error');
    }
}

function openModal(userId, username) {
    state.activeUserId = userId;
    state.activeUsername = username;
    elements.modalUser.textContent = username;
    elements.newPassword.value = '';
    elements.modal.classList.add('active');
    elements.modal.setAttribute('aria-hidden', 'false');
    elements.newPassword.focus();
}

function closeModal() {
    state.activeUserId = null;
    state.activeUsername = '';
    elements.modal.classList.remove('active');
    elements.modal.setAttribute('aria-hidden', 'true');
}

async function resetPassword() {
    const password = elements.newPassword.value.trim();
    if (password.length < 8) {
        showToast('Password must be at least 8 characters', 'error');
        return;
    }

    try {
        const response = await fetch(`/admin/users/${state.activeUserId}/password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
            throw new Error(payload.message || 'Failed to update password');
        }
        showToast(`Password updated for ${state.activeUsername}`);
        closeModal();
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Failed to update password', 'error');
    }
}

let searchTimer = null;
elements.searchInput.addEventListener('input', (event) => {
    state.search = event.target.value;
    state.offset = 0;
    if (searchTimer) {
        clearTimeout(searchTimer);
    }
    searchTimer = setTimeout(fetchUsers, 300);
});

elements.refreshButton.addEventListener('click', () => fetchUsers());

elements.pageSize.addEventListener('change', (event) => {
    state.limit = Number.parseInt(event.target.value, 10);
    state.offset = 0;
    fetchUsers();
});

elements.prevPage.addEventListener('click', () => {
    state.offset = Math.max(state.offset - state.limit, 0);
    fetchUsers();
});

elements.nextPage.addEventListener('click', () => {
    state.offset = state.offset + state.limit;
    fetchUsers();
});

elements.userRows.addEventListener('click', (event) => {
    const actionButton = event.target.closest('button[data-action]');
    if (!actionButton) {
        return;
    }

    const action = actionButton.dataset.action;
    const userId = Number.parseInt(actionButton.dataset.id, 10);

    if (!Number.isInteger(userId)) {
        return;
    }

    if (action === 'toggle-admin') {
        const isAdmin = actionButton.dataset.admin === '1';
        const message = isAdmin ? 'Remove admin access for this user?' : 'Grant admin access to this user?';
        if (window.confirm(message)) {
            toggleAdmin(userId, !isAdmin);
        }
        return;
    }

    if (action === 'reset-password') {
        openModal(userId, actionButton.dataset.username || 'user');
        return;
    }

    if (action === 'delete') {
        deleteUser(userId, actionButton.dataset.username || 'user');
    }
});

elements.savePassword.addEventListener('click', resetPassword);
elements.cancelModal.addEventListener('click', closeModal);
elements.closeModal.addEventListener('click', closeModal);
elements.modal.addEventListener('click', (event) => {
    if (event.target === elements.modal) {
        closeModal();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && elements.modal.classList.contains('active')) {
        closeModal();
    }
});

// Tab Navigation
function switchTab(tabName) {
    elements.tabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    elements.tabContents.forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabName}`);
    });

    if (tabName === 'settings') {
        fetchLobbyLines();
    }
}

elements.tabButtons.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Lobby Lines Management
function escapeHtmlForLines(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderLobbyLines() {
    const count = state.lobbyLines.length;
    elements.lineCount.textContent = `${count} line${count !== 1 ? 's' : ''}`;

    if (count === 0) {
        elements.lobbyLinesList.innerHTML = `
            <div class="lines-placeholder">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="17" y1="10" x2="3" y2="10"></line>
                    <line x1="21" y1="6" x2="3" y2="6"></line>
                    <line x1="21" y1="14" x2="3" y2="14"></line>
                    <line x1="17" y1="18" x2="3" y2="18"></line>
                </svg>
                <p>No lobby messages yet</p>
                <span class="muted">Add your first message above!</span>
            </div>
        `;
        return;
    }

    const lines = state.lobbyLines.map((line, index) => `
        <div class="line-item" data-index="${index}">
            <span class="line-number">${index + 1}</span>
            <span class="line-text">${escapeHtmlForLines(line)}</span>
            <div class="line-actions">
                <button type="button" class="ghost-button line-edit-btn" data-index="${index}" title="Edit">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
                <button type="button" class="danger-button line-delete-btn" data-index="${index}" title="Delete">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');

    elements.lobbyLinesList.innerHTML = lines;
}

async function fetchLobbyLines() {
    try {
        const response = await fetch('/admin/settings/lobby-lines');
        const payload = await response.json();

        if (!response.ok || !payload.success) {
            throw new Error(payload.message || 'Failed to fetch lobby lines');
        }

        state.lobbyLines = payload.lines || [];
        state.lobbyLinesChanged = false;
        renderLobbyLines();
    } catch (error) {
        console.error(error);
        showToast('Failed to load lobby lines', 'error');
    }
}

async function saveLobbyLines() {
    try {
        const response = await fetch('/admin/settings/lobby-lines', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lines: state.lobbyLines })
        });
        const payload = await response.json();

        if (!response.ok || !payload.success) {
            throw new Error(payload.message || 'Failed to save');
        }

        showToast('Saved');
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Failed to save', 'error');
    }
}

async function addLobbyLine() {
    const text = elements.newLineInput.value.trim();
    if (!text) {
        showToast('Please enter a message', 'error');
        return;
    }

    if (state.lobbyLines.length >= 1000) {
        showToast('Maximum 1000 lines allowed', 'error');
        return;
    }

    state.lobbyLines.push(text);
    elements.newLineInput.value = '';
    renderLobbyLines();
    await saveLobbyLines();
}

async function deleteLobbyLine(index) {
    if (index >= 0 && index < state.lobbyLines.length) {
        state.lobbyLines.splice(index, 1);
        renderLobbyLines();
        await saveLobbyLines();
    }
}

async function editLobbyLine(index) {
    const currentText = state.lobbyLines[index];
    const newText = prompt('Edit lobby message:', currentText);
    
    if (newText !== null && newText.trim() !== '') {
        state.lobbyLines[index] = newText.trim();
        renderLobbyLines();
        await saveLobbyLines();
    }
}

// Event listeners for lobby lines
if (elements.addLineButton) {
    elements.addLineButton.addEventListener('click', addLobbyLine);
}
if (elements.newLineInput) {
    elements.newLineInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            addLobbyLine();
        }
    });
}
if (elements.lobbyLinesList) {
    elements.lobbyLinesList.addEventListener('click', (event) => {
        const target = event.target;
        const deleteBtn = target.closest('.line-delete-btn');
        const editBtn = target.closest('.line-edit-btn');
        
        if (deleteBtn) {
            event.preventDefault();
            event.stopPropagation();
            const index = Number.parseInt(deleteBtn.dataset.index, 10);
            if (!Number.isNaN(index)) {
                deleteLobbyLine(index);
            }
        } else if (editBtn) {
            event.preventDefault();
            event.stopPropagation();
            const index = Number.parseInt(editBtn.dataset.index, 10);
            if (!Number.isNaN(index)) {
                editLobbyLine(index);
            }
        }
    });
}

fetchUsers();
