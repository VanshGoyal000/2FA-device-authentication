const socketIo = require('socket.io');

class WebSocketService {
  constructor(server) {
    this.io = socketIo(server, {
      cors: {
        origin: "*", // In production, specify your actual domains
        methods: ["GET", "POST"],
        credentials: true
      }
    });
    this.connections = new Map();
    this.initialize();
    console.log('WebSocketService instance created');
  }
  
  initialize() {
    this.io.on('connection', (socket) => {
      console.log(`New connection: ${socket.id}`);
      
      socket.on('register', (data) => {
        if (data.type === 'laptop' && data.sessionId) {
          // Register laptop connection with session ID
          this.connections.set(data.sessionId, socket.id);
          console.log(`Laptop registered with session: ${data.sessionId}`);
        } else if (data.type === 'mobile' && data.userId) {
          // Register mobile device with user ID
          this.connections.set(`user:${data.userId}`, socket.id);
          console.log(`Mobile registered for user: ${data.userId}`);
        }
      });

      socket.on('disconnect', () => {
        // Clean up connections on disconnect
        for (const [key, value] of this.connections.entries()) {
          if (value === socket.id) {
            this.connections.delete(key);
            console.log(`Removed connection for ${key}`);
          }
        }
      });
    });
  }

  // Send login request to mobile device
  sendLoginRequest(userId, requestData) {
    console.log(`Attempting to send login request to userId: ${userId}`);
    const socketId = this.connections.get(`user:${userId}`);
    if (socketId) {
      console.log(`Found socketId ${socketId} for userId ${userId}`);
      this.io.to(socketId).emit('login_request', requestData);
      return true;
    }
    console.log(`No socket connection found for userId: ${userId}`);
    return false;
  }

  // Send login result to laptop
  sendLoginResult(sessionId, result) {
    const socketId = this.connections.get(sessionId);
    if (socketId) {
      this.io.to(socketId).emit('login_result', result);
      return true;
    }
    return false;
  }
}

// THIS IS THE KEY CHANGE - Create a singleton instance
let webSocketServiceInstance = null;

module.exports = {
  initialize: (server) => {
    if (!webSocketServiceInstance) {
      webSocketServiceInstance = new WebSocketService(server);
      console.log('WebSocket service initialized with server');
    }
    return webSocketServiceInstance;
  },
  getInstance: () => {
    if (!webSocketServiceInstance) {
      console.error('WebSocket service accessed before initialization!');
    }
    return webSocketServiceInstance;
  }
};