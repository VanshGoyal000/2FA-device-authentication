const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const deviceController = require('../controllers/deviceController'); // Create this file

// Login request initiation from laptop
router.post('/login-request', authController.initiateLogin);

// Login request approval from mobile
router.post('/approve-login', authController.approveLogin);

// Login request rejection from mobile
router.post('/reject-login', authController.rejectLogin);

// Device registration
router.post('/register-device', deviceController.registerDevice);

router.get('/health-check', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

module.exports = router;