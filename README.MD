# Auth Phone

## Short Description
A secure, passwordless authentication system that verifies user identity through their mobile device instead of traditional passwords or SMS codes.

## Overview
Auth Phone implements a robust passwordless authentication system that sends login requests to a user's registered mobile device when they attempt to access a web application. Users approve or reject login requests using their fingerprint or face ID, providing a secure yet frictionless authentication experience.

The system consists of a backend server, mobile app, and web client integration that work together to create a complete authentication solution.

## Features

- **Passwordless Authentication** - No more passwords to remember or type
- **Biometric Security** - Uses fingerprint or face recognition for approval
- **Real-time Notifications** - Instant login request notification via WebSockets
- **Detailed Context Information** - Shows location, IP address and device info
- **Push Notifications** - Alerts users even when app is in background
- **WebSocket Communication** - Real-time authentication flow
- **JWT Authentication** - Secure tokens for authenticated sessions
- **Cross-Platform** - Works on iOS and Android devices

## System Architecture

Auth Phone consists of three main components:

1. **Backend Server** - Node.js/Express server with MongoDB and Socket.IO
2. **Mobile App** - React Native/Expo app that receives and approves login requests
3. **Web Client** - HTML/CSS/JS frontend for websites to implement Auth Phone

## Getting Started

### Prerequisites

- Node.js (v14+)
- MongoDB
- Expo CLI (for mobile app)
- Web browser

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/auth-phone.git

# Navigate to backend directory
cd auth-phone/backend

# Install dependencies
npm install

# Create .env file with required variables
# Example:
# MONGODB_URI=mongodb://localhost:27017/auth_phone
# JWT_SECRET=your_jwt_secret_key
# REQUEST_EXPIRY_TIME=5

# Start the server
npm start
```

### Mobile App Setup

```bash
# Navigate to mobile app directory
cd auth-phone/mobile-app

# Install dependencies
npm install

# Update SERVER_IP in App.js to your computer's IP address

# Start Expo development server
expo start
```

### Web Client Setup

```bash
# Navigate to web client directory
cd auth-phone/web-client

# Open index.html in a web browser
# Or serve it using a simple HTTP server:
npx http-server -c-1
```

## Usage Flow

### 1. User Registration

1. Create user account in the system
2. Install the Auth Phone mobile app
3. Register the device with user credentials
4. Mobile app will now be ready to receive authentication requests

### 2. Authentication Process

1. User enters email on login page
2. Backend sends login request to registered mobile device
3. Mobile app shows notification with login details
4. User approves with fingerprint/face ID
5. Web application receives authentication token
6. User is logged in without entering password

## API Documentation

### Authentication Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/register-device` | POST | Register a mobile device |
| `/api/login-request` | POST | Initiate login from web client |
| `/api/approve-login` | POST | Approve login from mobile device |
| `/api/reject-login` | POST | Reject login from mobile device |
| `/api/health-check` | GET | Check API health status |

### WebSocket Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `register` | Client → Server | Register device with user ID or session ID |
| `login_request` | Server → Client | Send login request to mobile device |
| `login_result` | Server → Client | Send authentication result to web client |

## Configuration Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `MONGODB_URI` | string | MongoDB connection string | mongodb://localhost:27017/auth_phone |
| `JWT_SECRET` | string | Secret for signing JWT tokens | required |
| `REQUEST_EXPIRY_TIME` | number | Login request expiration time in minutes | 5 |
| `PORT` | number | Server port | 3000 |

## Security Considerations

- All communications use HTTPS/WSS protocols
- Biometric verification ensures physical device possession
- Device registration requires initial password verification
- Login requests expire after a configurable timeout
- IP address and device information are logged for suspicious activity detection
- Cryptographic signatures verify request authenticity

## Project Structure

```
auth_phone/
├── backend/              # Node.js server
│   ├── src/
│   │   ├── controllers/  # Request handlers
│   │   ├── models/       # Database models
│   │   ├── routes/       # API routes
│   │   ├── services/     # WebSocket service
│   │   └── app.js        # Express app setup
│   ├── server.js         # Entry point
│   └── createUser.js     # User creation utility
│
├── mobile-app/           # React Native/Expo app
│   ├── assets/           # Images and icons
│   ├── App.js            # Main app component
│   ├── app.json          # Expo configuration
│   └── package.json      # Dependencies
│
└── web-client/           # Frontend integration
    ├── index.html        # Login page
    ├── app.js            # Client-side logic
    └── dashboard.html    # Post-login page
```

## Documentation
For complete documentation, visit [https://docs.auth-phone.com](https://docs.auth-phone.com)

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## License
This project is licensed under the MIT License - see the LICENSE file for details.
