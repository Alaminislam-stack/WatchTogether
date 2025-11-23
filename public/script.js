const socket = io({
    transports: ['websocket', 'polling'], // Try WebSocket first, then polling
    reconnection: true,
    reconnectionAttempts: 10
});
const roomName = 'watch-together-room'; // Hardcoded for simplicity as per requirements
let localStream;
let peerConnection;
let dataChannel;
peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
        socket.emit('candidate', event.candidate, roomName);
    }
};

peerConnection.onconnectionstatechange = () => {
    if (peerConnection.connectionState === 'connected') {
        statusSpan.textContent = 'Status: Connected (P2P)';
    }
};

if (!isInitiator) {
    peerConnection.ondatachannel = (event) => {
        dataChannel = event.channel;
        setupDataChannel();
    };
}
}

function createDataChannel() {
    dataChannel = peerConnection.createDataChannel('chat');
    setupDataChannel();
}

function setupDataChannel() {
    dataChannel.onopen = () => {
        console.log('Data channel open');
        statusSpan.textContent = 'Status: Connected (Data Channel Open)';
        // Request current state from peer
        dataChannel.send(JSON.stringify({ type: 'request-sync' }));
    };

    dataChannel.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleDataMessage(msg);
    };
}

function createOffer() {
    peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
            socket.emit('offer', peerConnection.localDescription, roomName);
        })
        .catch(e => console.error(e));
}

function createAnswer() {
    peerConnection.createAnswer()
        .then(answer => peerConnection.setLocalDescription(answer))
        .then(() => {
            socket.emit('answer', peerConnection.localDescription, roomName);
        })
        .catch(e => console.error(e));
}

function handleDataMessage(msg) {
    if (msg.type === 'chat') {
        msg.user = 'Peer';
        appendMessage(msg, 'remote');
    } else if (msg.type === 'video-sync') {
        syncVideo(msg);
    } else if (msg.type === 'load-video') {
        player.loadVideoById(msg.videoId);
        videoUrlInput.value = msg.url || ''; // Update input box
    } else if (msg.type === 'request-sync') {
        // Send current state
        if (player && player.getVideoData) {
            const videoData = player.getVideoData();
            const videoId = videoData ? videoData.video_id : null;
            if (videoId) {
                const response = {
                    type: 'sync-response',
                    videoId: videoId,
                    time: player.getCurrentTime(),
                    state: player.getPlayerState(),
                    url: videoUrlInput.value
                };
                dataChannel.send(JSON.stringify(response));
            }
        }
    } else if (msg.type === 'sync-response') {
        player.loadVideoById(msg.videoId);
        videoUrlInput.value = msg.url || '';
        // Wait for video to load before seeking
        setTimeout(() => {
            player.seekTo(msg.time, true);
            if (msg.state === YT.PlayerState.PLAYING) {
                player.playVideo();
            }
        }, 1000);
    }
}

function syncVideo(msg) {
    isSyncing = true;
    const state = msg.state;
    const time = msg.time;

    // Simple sync logic: if difference is significant, seek.
    // If state is different, apply state.

    if (Math.abs(player.getCurrentTime() - time) > 1) {
        player.seekTo(time, true);
    }

    if (state === YT.PlayerState.PLAYING) {
        player.playVideo();
    } else if (state === YT.PlayerState.PAUSED) {
        player.pauseVideo();
    }

    // Reset sync flag after a short delay to allow events to settle
    setTimeout(() => {
        isSyncing = false;
    }, 500);
}
