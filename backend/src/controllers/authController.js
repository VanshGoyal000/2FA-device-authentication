const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Device = require('../models/Device');
const LoginRequest = require('../models/LoginRequest');
// Remove this line
// const webSocketService = require('../services/webSocketService').getInstance();
// Add this line instead
const webSocketServiceModule = require('../services/webSocketService');
const { JWT_SECRET, REQUEST_EXPIRY_TIME } = process.env;

exports.initiateLogin = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Find user by email
    const user = await User.findOne({ email }).populate('devices');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if user has registered devices
    if (!user.devices || user.devices.length === 0) {
      return res.status(400).json({ 
        error: 'No registered devices found',
        fallback: true // Let frontend know to use password fallback
      });
    }
    
    // Use the first device for simplicity (could be enhanced to select a specific device)
    const device = user.devices[0];
    
    // Generate a unique login request ID
    const requestId = crypto.randomBytes(16).toString('hex');
    const sessionId = crypto.randomBytes(16).toString('hex');
    
    // Calculate expiry time
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + (REQUEST_EXPIRY_TIME || 5));
    
    // Create login request record
    const loginRequest = new LoginRequest({
      userId: user._id,
      deviceId: device._id,
      requestId,
      expiresAt,
      clientInfo: {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        location: req.body.location || 'Unknown'
      }
    });
    
    await loginRequest.save();
    
    // Get WebSocket service instance when needed
    const webSocketService = webSocketServiceModule.getInstance();
    
    // Send WebSocket event to mobile app
    const notified = webSocketService.sendLoginRequest(user._id.toString(), {
      type: 'login_request',
      login_request_id: requestId,
      device_id: device.deviceId,
      client_info: loginRequest.clientInfo
    });
    
    return res.status(200).json({
      message: 'Login request initiated',
      requestId,
      sessionId,
      notified,
      expiresAt
    });
  } catch (error) {
    console.error('Login initiation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.approveLogin = async (req, res) => {
  // In the backend's authController.js
console.log("Login request data:", req.body);
console.log("Expected sessionId:", loginRequest.sessionId);
  try {
    const { requestId, deviceId, userId, signature, timestamp, algorithm } = req.body;
    
    // Validate required fields
    if (!requestId || !deviceId || !userId || !signature || !timestamp) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Find the login request
    const loginRequest = await LoginRequest.findOne({ requestId });
    
    if (!loginRequest) {
      return res.status(404).json({ error: 'Login request not found' });
    }
    
    // Check if expired
    if (new Date() > new Date(loginRequest.expiresAt)) {
      return res.status(400).json({ error: 'Login request expired' });
    }
    
    // Find the device
    const device = await Device.findOne({ deviceId });
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    // Check if device belongs to user
    if (device.userId.toString() !== userId) {
      return res.status(403).json({ error: 'Device does not belong to user' });
    }
    
    // Create the string that was signed
    const dataToVerify = `${requestId}:${timestamp}`;
    
    // Use a simple hash verification method that's compatible with Expo's Crypto
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(dataToVerify).digest('base64');
    
    // Compare hashes directly (simple but less secure)
    if (hash !== signature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: device.userId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Update login request status
    loginRequest.status = 'approved';
    loginRequest.resolvedAt = new Date();
    await loginRequest.save();
    
    // Get WebSocket service instance when needed
    const webSocketService = webSocketServiceModule.getInstance();
    
    // Send login success via WebSocket
    const notified = webSocketService.sendLoginResult(req.body.sessionId, {
      type: 'login_success',
      jwt_token: token
    });
    
    return res.status(200).json({
      message: 'Login approved',
      token,
      notified
    });
  } catch (error) {
    console.error('Login approval error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.rejectLogin = async (req, res) => {
  try {
    const { login_request_id, sessionId } = req.body;
    
    const loginRequest = await LoginRequest.findOne({ requestId: login_request_id });
    if (!loginRequest) {
      return res.status(404).json({ error: 'Login request not found' });
    }
    
    loginRequest.status = 'rejected';
    loginRequest.updatedAt = new Date();
    await loginRequest.save();
    
    // Notify the waiting laptop
    webSocketService.sendLoginResult(sessionId, {
      type: 'login_rejected',
      message: 'Login request rejected by user'
    });
    
    return res.status(200).json({ message: 'Login request rejected' });
  } catch (error) {
    console.error('Login rejection error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
