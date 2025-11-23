const socket = io({
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10
});

const roomName = 'watch-together-room';
let localStream;
let peerConnection;
let dataChannel;
let player;
let isInitiator = false;
let isSyncing = false;
let candidateQueue = [];

const config = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
    ]
};

// Debug Logger
const debugDiv = document.getElementById('debugLog');
function log(msg) {
    if (debugDiv) {
        debugDiv.innerHTML += `<div>${new Date().toLocaleTimeString()} - ${msg}</div>`;
        debugDiv.scrollTop = debugDiv.scrollHeight;
    }
}
// Replace console.log with our log function for critical parts
const originalLog = console.log;
console.log = function (...args) {
    originalLog.apply(console, args);
    log(args.join(' '));
};
console.error = function (...args) {
    originalLog.apply(console, args);
    log('ERROR: ' + args.join(' '));
};

// DOM Elements
const videoUrlInput = document.getElementById('videoUrl');
const loadBtn = document.getElementById('loadBtn');
const connectBtn = document.getElementById('connectBtn');
const statusSpan = document.getElementById('status');
const chatBox = document.getElementById('chatBox');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');

// YouTube IFrame API
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: '',
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerReady(event) {
    console.log('Player ready');
}

function onPlayerStateChange(event) {
    if (isSyncing) return;
    if (dataChannel && dataChannel.readyState === 'open') {
        const state = event.data;
        const time = player.getCurrentTime();
        dataChannel.send(JSON.stringify({
            type: 'video-sync',
            state: state,
            time: time
        }));
    }
}

// Load YouTube API
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// UI Events
loadBtn.addEventListener('click', () => {
    const url = videoUrlInput.value;
    const videoId = extractVideoId(url);
    if (videoId) {
        if (player && typeof player.loadVideoById === 'function') {
            player.loadVideoById(videoId);
            if (dataChannel && dataChannel.readyState === 'open') {
                dataChannel.send(JSON.stringify({
                    type: 'load-video',
                    videoId: videoId,
                    url: url
                }));
            }
        } else {
            console.error('Player not ready');
        }
    } else {
        alert('Invalid YouTube URL');
    }
});

connectBtn.addEventListener('click', () => {
    socket.emit('join', roomName);
    connectBtn.disabled = true;
    statusSpan.textContent = 'Status: Connecting...';
});

sendBtn.addEventListener('click', sendMessage);
msgInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const text = msgInput.value.trim();
    if (text && dataChannel && dataChannel.readyState === 'open') {
        const message = {
            type: 'chat',
            text: text,
            timestamp: new Date().toLocaleTimeString(),
            user: 'Me'
        };
        dataChannel.send(JSON.stringify(message));
        appendMessage(message, 'local');
        msgInput.value = '';
    }
}

function appendMessage(msg, type) {
    const div = document.createElement('div');
    div.className = `message ${type}`;
    div.innerHTML = `<span class="timestamp">${msg.timestamp} - ${msg.user}</span>${msg.text}`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function extractVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Socket.io Signaling
socket.on('connect_error', (err) => {
    console.log('Connection Error:', err);
    statusSpan.textContent = 'Status: Connection Error';
});

socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
    statusSpan.textContent = 'Status: Disconnected (' + reason + ')';
    connectBtn.disabled = false;
});

socket.on('created', (room) => {
    console.log('Created room ' + room);
    isInitiator = true;
    statusSpan.textContent = 'Status: Waiting for peer...';
});

socket.on('joined', (room) => {
    console.log('Joined room ' + room);
    isInitiator = false;
    statusSpan.textContent = 'Status: Connected to room';
});

socket.on('full', (room) => {
    console.log('Room ' + room + ' is full');
    statusSpan.textContent = 'Status: Room Full';
    connectBtn.disabled = false;
});

socket.on('ready', () => {
    console.log('Room ready');
    statusSpan.textContent = 'Status: Peer joined. Starting WebRTC...';
    if (isInitiator) {
        createPeerConnection();
        createDataChannel();
        createOffer();
    } else {
        createPeerConnection();
    }
});

socket.on('offer', (offer) => {
    if (!isInitiator && !peerConnection) {
        createPeerConnection();
    }
    peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => {
            while (candidateQueue.length > 0) {
                const candidate = candidateQueue.shift();
                peerConnection.addIceCandidate(candidate).catch(e => console.error(e));
            }
            if (!isInitiator) {
                createAnswer();
            }
        });
});

socket.on('answer', (answer) => {
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
        .then(() => {
            while (candidateQueue.length > 0) {
                const candidate = candidateQueue.shift();
                peerConnection.addIceCandidate(candidate).catch(e => console.error(e));
            }
        });
});

socket.on('candidate', (candidate) => {
    const iceCandidate = new RTCIceCandidate(candidate);
    if (peerConnection && peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
        peerConnection.addIceCandidate(iceCandidate).catch(e => console.error(e));
    } else {
        candidateQueue.push(iceCandidate);
    }
});

// WebRTC Logic
function createPeerConnection() {
    peerConnection = new RTCPeerConnection(config);

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
        if (player && typeof player.loadVideoById === 'function') {
            player.loadVideoById(msg.videoId);
            videoUrlInput.value = msg.url || '';
        }
    } else if (msg.type === 'request-sync') {
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
        if (player && typeof player.loadVideoById === 'function') {
            player.loadVideoById(msg.videoId);
            videoUrlInput.value = msg.url || '';
            setTimeout(() => {
                player.seekTo(msg.time, true);
                if (msg.state === YT.PlayerState.PLAYING) {
                    player.playVideo();
                }
            }, 1000);
        }
    }
}

function syncVideo(msg) {
    isSyncing = true;
    const state = msg.state;
    const time = msg.time;

    if (Math.abs(player.getCurrentTime() - time) > 1) {
        player.seekTo(time, true);
    }

    if (state === YT.PlayerState.PLAYING) {
        player.playVideo();
    } else if (state === YT.PlayerState.PAUSED) {
        player.pauseVideo();
    }

    setTimeout(() => {
        isSyncing = false;
    }, 500);
}
