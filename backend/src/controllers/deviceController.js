const User = require('../models/User');
const Device = require('../models/Device');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

exports.registerDevice = async (req, res) => {
  console.log("trying to register");
  console.log("Registration attempt with email:", req.body.email);
  try {
    const { email, password, deviceName, deviceModel, publicKey, pushToken } = req.body;
    
    // Validate required fields
    if (!email || !password || !deviceName || !publicKey) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['email', 'password', 'deviceName', 'publicKey'] 
      });
    }
    
    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate unique device ID
    const deviceId = crypto.randomBytes(16).toString('hex');
    
    // Create new device
    const device = new Device({
      userId: user._id,
      deviceId,
      deviceName,
      deviceModel: deviceModel || 'Unknown Device',
      publicKey,
      pushToken
    });
    
    await device.save();
    
    // Add device to user's devices
    user.devices.push(device._id);
    await user.save();
    
    return res.status(201).json({
      message: 'Device registered successfully',
      userId: user._id,
      deviceId
    });
    
  } catch (error) {
    console.error('Device registration error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};