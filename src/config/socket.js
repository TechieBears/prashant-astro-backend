const { Server } = require('socket.io');

let io = null;

/**
 * Initialize Socket.IO server
 * @param {http.Server} server - HTTP server instance
 */
const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: process.env.CORS_ORIGIN?.split(',') || '*',
            methods: ['GET', 'POST'],
            credentials: true
        },
        transports: ['websocket', 'polling']
    });

    io.on('connection', (socket) => {
        console.log(`✅ Client connected: ${socket.id}`);

        // Handle subscription to call astrologers updates
        socket.on('subscribe:call-astrologers', () => {
            socket.join('call-astrologers');
            console.log(`📡 Client ${socket.id} subscribed to call-astrologers updates`);
        });

        // Handle unsubscription
        socket.on('unsubscribe:call-astrologers', () => {
            socket.leave('call-astrologers');
            console.log(`📡 Client ${socket.id} unsubscribed from call-astrologers updates`);
        });

        socket.on('disconnect', () => {
            console.log(`❌ Client disconnected: ${socket.id}`);
        });
    });

    console.log('🔌 Socket.IO initialized');
    return io;
};

/**
 * Get Socket.IO instance
 * @returns {Server|null} Socket.IO server instance
 */
const getIO = () => {
    if (!io) {
        throw new Error('Socket.IO not initialized. Call initSocket() first.');
    }
    return io;
};

/**
 * Emit updated call astrologers data to all subscribed clients
 * @param {Object} data - The updated call astrologers data
 */
const emitCallAstrologersUpdate = (data) => {
    if (!io) {
        console.warn('⚠️ Socket.IO not initialized, cannot emit update');
        return;
    }
    io.to('call-astrologers').emit('call-astrologers:updated', data);
    console.log('📤 Emitted call-astrologers update to subscribed clients');
};

module.exports = {
    initSocket,
    getIO,
    emitCallAstrologersUpdate
};

