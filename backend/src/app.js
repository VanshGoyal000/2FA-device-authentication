const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const dotenv = require('dotenv');
const apiRoutes = require('./routes/api');
const webSocketService = require('./services/webSocketService');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const server = http.createServer(app);

// Configure middleware
app.use(cors());
app.use(express.json());

// Initialize WebSocket service - IMPORTANT: do this BEFORE using getInstance anywhere
const wsService = webSocketService.initialize(server);
console.log('WebSocket service initialized:', wsService ? 'SUCCESS' : 'FAILED');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/auth_phone')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// API routes
app.use('/api', apiRoutes);

// Basic route for testing
app.get('/api/health-check', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

module.exports = { app, server };