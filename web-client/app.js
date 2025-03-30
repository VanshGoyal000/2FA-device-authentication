document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const loginBtn = document.getElementById('login-btn');
    const emailInput = document.getElementById('email');
    const statusContainer = document.getElementById('status-container');
    const statusTitle = document.getElementById('status-title');
    const statusMessage = document.getElementById('status-message');
    const verificationContainer = document.getElementById('verification-container');
    const timeoutCounter = document.getElementById('timeout-counter');
    
    // Server URL - update to match your server
    const SERVER_URL = 'http://localhost:3000';
    const API_URL = `${SERVER_URL}/api`;
    
    // Socket.io connection
    let socket;
    let sessionId;
    let countdownInterval;
    
    // Initialize socket connection
    function initializeSocket() {
        socket = io(SERVER_URL, {
            transports: ['websocket'],
            reconnectionAttempts: 5
        });
        
        socket.on('connect', () => {
            console.log('Connected to WebSocket server');
        });
        
        socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            showStatus('error', 'Connection Error', 'Could not connect to authentication server.');
        });
        
        socket.on('login_result', (result) => {
            console.log('Received login result:', result);
            
            if (result.type === 'login_success') {
                // Store JWT token
                localStorage.setItem('auth_token', result.jwt_token);
                
                // Show success message
                showStatus('success', 'Authentication Successful', 'You are now logged in.');
                
                // Hide verification UI
                verificationContainer.style.display = 'none';
                
                // Stop countdown
                clearInterval(countdownInterval);
                
                // Redirect to dashboard or home page
                setTimeout(() => {
                    window.location.href = './dashboard.html'; // Update with your destination
                }, 2000);
            } else if (result.type === 'login_rejected') {
                showStatus('error', 'Authentication Rejected', 'The login request was rejected from your mobile device.');
                verificationContainer.style.display = 'none';
                clearInterval(countdownInterval);
            } else if (result.type === 'login_expired') {
                showStatus('error', 'Authentication Expired', 'The login request has expired. Please try again.');
                verificationContainer.style.display = 'none';
                clearInterval(countdownInterval);
            }
        });
    }
    
    // Initialize on page load
    initializeSocket();
    
    // Handle login request
    loginBtn.addEventListener('click', async function() {
        const email = emailInput.value.trim();
        
        if (!email) {
            showStatus('error', 'Validation Error', 'Please enter your email address.');
            return;
        }
        
        if (!isValidEmail(email)) {
            showStatus('error', 'Validation Error', 'Please enter a valid email address.');
            return;
        }
        
        // Show loading state
        loginBtn.disabled = true;
        const originalBtnText = loginBtn.innerHTML;
        loginBtn.innerHTML = '<div class="spinner"></div>Sending Request...';
        
        try {
            const response = await fetch(`${API_URL}/login-request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    email: email,
                    location: await getLocation() 
                }),
            });
            
            const data = await response.json();
            
            if (response.ok) {
                console.log('Login request successful:', data);
                
                // Store session ID for socket registration
                sessionId = data.sessionId;
                
                // Register this device with the socket
                socket.emit('register', { 
                    type: 'laptop', 
                    sessionId: sessionId 
                });
                
                // Show verification UI
                loginForm.style.display = 'none';
                verificationContainer.style.display = 'block';
                
                // Start countdown timer
                startExpiryCountdown(new Date(data.expiresAt));
                
                showStatus('info', 'Authentication Requested', 'Please check your mobile device to approve this login request.');
            } else {
                showStatus('error', 'Authentication Error', data.error || 'Failed to initiate login request.');
            }
        } catch (error) {
            console.error('Login request error:', error);
            showStatus('error', 'Connection Error', 'Could not connect to authentication server. Please try again.');
        } finally {
            // Restore button state
            loginBtn.disabled = false;
            loginBtn.innerHTML = originalBtnText;
        }
    });
    
    // Helper function to show status messages
    function showStatus(type, title, message) {
        statusTitle.textContent = title;
        statusMessage.textContent = message;
        
        statusContainer.className = 'status-container';
        statusContainer.classList.add(type);
        statusContainer.style.display = 'block';
    }
    
    // Helper function to validate email
    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    
    // Helper function to get approximate location
    async function getLocation() {
        try {
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();
            return `${data.city}, ${data.region}, ${data.country_name}`;
        } catch (error) {
            console.error('Error getting location:', error);
            return 'Unknown location';
        }
    }
    
    // Helper function for countdown timer
    function startExpiryCountdown(expiryDate) {
        function updateCountdown() {
            const now = new Date();
            const timeLeft = expiryDate - now;
            
            if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                timeoutCounter.textContent = 'Request expired';
                showStatus('error', 'Authentication Expired', 'The login request has expired. Please try again.');
                return;
            }
            
            const minutes = Math.floor(timeLeft / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
            
            timeoutCounter.textContent = `Expires in: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        
        updateCountdown(); // Run immediately
        countdownInterval = setInterval(updateCountdown, 1000);
    }
});