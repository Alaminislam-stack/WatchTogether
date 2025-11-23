const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
});

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Store room state (optional, for simple validation)
const rooms = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join', (roomName) => {
        const room = io.sockets.adapter.rooms.get(roomName);
        const numClients = room ? room.size : 0;

        if (numClients === 0) {
            socket.join(roomName);
            console.log(`User ${socket.id} created room ${roomName}`);
            socket.emit('created', roomName);
        } else if (numClients === 1) {
            socket.join(roomName);
            console.log(`User ${socket.id} joined room ${roomName}`);
            socket.emit('joined', roomName);
            io.to(roomName).emit('ready'); // Notify peers to start connection
        } else {
            socket.emit('full', roomName);
        }
    });

    // Signaling events
    socket.on('offer', (offer, roomName) => {
        socket.to(roomName).emit('offer', offer);
    });

    socket.on('answer', (answer, roomName) => {
        socket.to(roomName).emit('answer', answer);
    });

    socket.on('candidate', (candidate, roomName) => {
        socket.to(roomName).emit('candidate', candidate);
    });

    socket.on('disconnect', (reason) => {
        console.log('User disconnected:', socket.id, 'Reason:', reason);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
