require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./src/models/User');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/auth_phone';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function createTestUser() {
  try {
    // Email to use for testing
    const email = 'vanshgoyal9528@gmail.com';
    const password = 'test123'; // Simple password for testing
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      console.log(`User with email ${email} already exists`);
      console.log('User ID:', existingUser._id);
      mongoose.connection.close();
      return;
    }
    
    // Create new user
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = new User({
      email,
      username: email.split('@')[0], // Use part before @ as username
      password: hashedPassword,
      devices: []
    });
    
    await newUser.save();
    
    console.log('Test user created successfully');
    console.log('User ID:', newUser._id);
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Use these credentials in your mobile app registration');
    
  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    mongoose.connection.close();
  }
}

createTestUser();