document.addEventListener('DOMContentLoaded', function() {
    const joinButton = document.getElementById('joinButton');
    const roomCodeInput = document.getElementById('roomCodeInput');

    function handleJoin() {
        const roomCode = roomCodeInput.value.trim();
        if (roomCode.length === 7) {
            window.location.href = `/vortex/join/${roomCode}`;
        } else {
            alert('Please enter a valid 7-digit room code.');
        }
    }

    joinButton.addEventListener('click', handleJoin);
    roomCodeInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleJoin();
        }
    });
});
