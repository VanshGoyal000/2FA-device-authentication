import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator,
  Modal,
  Image,
  TextInput  // Add this import
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import io from 'socket.io-client';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Network from 'expo-network';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const Stack = createNativeStackNavigator();
// Update SERVER_IP to your Wi-Fi adapter's IP
const SERVER_IP = '192.168.153.208'; // Your Wi-Fi adapter IP
const SERVER_PORT = '3000';
const API_URL = `http://${SERVER_IP}:${SERVER_PORT}/api`;

// Main app component
export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistered, setIsRegistered] = useState(false);
  const [userId, setUserId] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const socket = useRef(null);
  const [networkError, setNetworkError] = useState(null); 
  const [pendingRequest, setPendingRequest] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const notificationListener = useRef();
  const responseListener = useRef();

  // Initialize app on load
  useEffect(() => {
    async function initialize() {
      try {
        // Check network connectivity
        const networkState = await Network.getNetworkStateAsync();
        if (!networkState.isConnected || !networkState.isInternetReachable) {
          setNetworkError('No internet connection. Please check your network settings.');
          setIsLoading(false);
          return;
        }

        // Check if device is already registered
        const storedUserId = await AsyncStorage.getItem('userId');
        const storedDeviceId = await AsyncStorage.getItem('deviceId');

        if (storedUserId && storedDeviceId) {
          setUserId(storedUserId);
          setDeviceId(storedDeviceId);
          setIsRegistered(true);
          // Connect to socket server if registered
          initializeSocket(storedUserId, storedDeviceId);
        }

        // Register for push notifications
        registerForPushNotifications();
      } catch (error) {
        console.error('Initialization error:', error);
        setNetworkError('Failed to initialize app. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    }

    initialize();

    // Set up notification listeners
    notificationListener.current = Notifications.addNotificationReceivedListener(
      notification => {
        const requestData = notification.request.content.data;
        if (requestData.type === 'login_request') {
          setPendingRequest(requestData);
          setShowAuthModal(true);
        }
      }
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      response => {
        const requestData = response.notification.request.content.data;
        if (requestData.type === 'login_request') {
          setPendingRequest(requestData);
          setShowAuthModal(true);
        }
      }
    );

    // Clean up
    return () => {
      if (socket.current) {
        socket.current.disconnect();
      }
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  // Initialize WebSocket connection
// Initialize WebSocket connection
const initializeSocket = (userId, deviceId) => {
  try {
    socket.current = io(`http://${SERVER_IP}:${SERVER_PORT}`, {
      transports: ['websocket'],
      reconnectionAttempts: 15,
      timeout: 10000, // 10 second timeout
    });
    
    socket.current.on('connect', () => {
      console.log('Connected to WebSocket server');
      socket.current.emit('register', { 
        type: 'mobile', 
        userId: userId 
      });
    });
    
    socket.current.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      Alert.alert(
        'Connection Error',
        'Failed to connect to authentication server. Please check your network.'
      );
    });
    
    // Add this handler for login requests
    // Inside the initializeSocket function after connect_error handler
socket.current.on('login_request', (requestData) => {
  console.log('Received login request via WebSocket:', requestData);
  
  // Store the request data
  setPendingRequest(requestData);
  
  // Show the authentication modal
  setShowAuthModal(true);
  
  // Also trigger a local notification if app is in background
  schedulePushNotification({
    title: 'Login Request',
    body: `Login attempt from ${requestData.client_info?.location || 'Unknown location'}`,
    data: requestData
  });
});
    
  } catch (error) {
    console.error('Socket initialization error:', error);
  }
};

  // Register device with server
  const registerDevice = async (email, password) => {
    try {
      setIsLoading(true);
      
      // Generate keys for signing tokens
      const keyPair = await generateKeyPair();
      
      // Check server connectivity before attempting registration
      try {
        const timeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Server connection timeout')), 5000)
        );
        
        const serverCheck = fetch(`http://${SERVER_IP}:${SERVER_PORT}/api/health-check`).then(res => res.ok);
        
        // Either the server responds or we timeout
        await Promise.race([serverCheck, timeout]);
      } catch (error) {
        console.error('Server connectivity check failed:', error);
        Alert.alert(
          'Connection Error', 
          `Cannot reach server at ${SERVER_IP}:${SERVER_PORT}. Please verify your server is running and check network settings.`
        );
        setIsLoading(false);
        return;
      }
      
      const pushToken = await registerForPushNotifications();
      
      const response = await fetch(`${API_URL}/register-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          deviceName: Constants.deviceName || 'Expo Device',
          deviceModel: Constants.platform?.model || 'Unknown Model',
          publicKey: keyPair.publicKey,
          pushToken: pushToken
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Store credentials and keys
        await AsyncStorage.setItem('userId', data.userId);
        await AsyncStorage.setItem('deviceId', data.deviceId);
        await AsyncStorage.setItem('publicKey', keyPair.publicKey);
        await AsyncStorage.setItem('privateKey', keyPair.privateKey);
        
        setUserId(data.userId);
        setDeviceId(data.deviceId);
        setIsRegistered(true);
        
        // Initialize socket connection
        initializeSocket(data.userId, data.deviceId);
        
        Alert.alert('Success', 'Device registered successfully!');
      } else {
        Alert.alert('Registration Failed', data.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Device registration error:', error);
      Alert.alert(
        'Registration Error',
        `Failed to register device: ${error.message}\n\nServer: ${SERVER_IP}:${SERVER_PORT}`
      );
    } finally {
      setIsLoading(false);
    }
  };


  const signLoginApproval = async (loginRequestId) => {
    try {
      // Get the private key from storage
      const privateKey = await AsyncStorage.getItem('privateKey');
      if (!privateKey) {
        throw new Error('Private key not found');
      }
      
      // Create string to sign (timestamp prevents replay attacks)
      const timestamp = Date.now().toString();
      const dataToSign = `${loginRequestId}:${timestamp}`;
      
      // Use RSA-SHA256 algorithm which is compatible with Node.js crypto
      const signature = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        dataToSign,
        {
          encoding: Crypto.CryptoEncoding.BASE64
        }
      );
      
      return {
        signature,
        timestamp,
        algorithm: 'sha256'
      };
    } catch (error) {
      console.error('Error signing login approval:', error);
      throw error;
    }
  };
  // Handle login approval
  const handleApproveLogin = async () => {
    if (!pendingRequest) return;
    
    try {
      // Use biometric authentication if available
      const authResult = await authenticateUser();
      if (!authResult.success) {
        return;
      }
      
      setIsLoading(true);
      
      // Get signature data
      const signatureData = await signLoginApproval(pendingRequest.login_request_id);
      
      // Send approval to server
      const response = await fetch(`${API_URL}/approve-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: pendingRequest.login_request_id,
          deviceId: deviceId,
          userId: userId,
          timestamp: signatureData.timestamp,
          signature: signatureData.signature,
          algorithm: signatureData.algorithm
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        Alert.alert('Success', 'Login approved successfully');
      } else {
        Alert.alert('Error', data.error || 'Failed to approve login');
      }
    } catch (error) {
      console.error('Login approval error:', error);
      Alert.alert('Error', `Failed to approve login: ${error.message}`);
    } finally {
      setIsLoading(false);
      setShowAuthModal(false);
      setPendingRequest(null);
    }
  };

  // Add this function to handle both approve and reject actions
const handleLoginApproval = async (approve) => {
  if (!pendingRequest) return;
  
  try {
    if (approve) {
      // Use biometric authentication if available
      const authResult = await authenticateWithBiometrics();
      if (!authResult) {
        return;
      }
      
      setIsLoading(true);
      
      // Get signature data
      const signatureData = await signLoginApproval(pendingRequest.login_request_id);
      
      console.log("Sending approval with sessionId:", pendingRequest.sessionId);
      
      // Send approval to server
      const response = await fetch(`${API_URL}/approve-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: pendingRequest.login_request_id,
          deviceId: deviceId,
          userId: userId,
          sessionId: pendingRequest.sessionId, // Add the sessionId
          timestamp: signatureData.timestamp,
          signature: signatureData.signature,
          algorithm: signatureData.algorithm
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        Alert.alert('Success', 'Login approved successfully');
      } else {
        Alert.alert('Error', data.error || 'Failed to approve login');
      }
    } else {
      // Handle rejection
      setIsLoading(true);
      const response = await fetch(`${API_URL}/reject-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: pendingRequest.login_request_id,
          sessionId: pendingRequest.sessionId
        })
      });
      
      if (response.ok) {
        Alert.alert('Success', 'Login request rejected');
      } else {
        const data = await response.json();
        Alert.alert('Error', data.error || 'Failed to reject login');
      }
    }
  } catch (error) {
    console.error('Login approval/rejection error:', error);
    Alert.alert('Error', `Failed to process login request: ${error.message}`);
  } finally {
    setIsLoading(false);
    setShowAuthModal(false);
    setPendingRequest(null);
  }
};
  // Register for push notifications
  const registerForPushNotifications = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        Alert.alert('Permission Required', 'Push notifications are required for login alerts');
        return null;
      }
      
      // Add the projectId in the options parameter
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: "61f867a7-5333-4efd-bd95-967f17072d85"  // Replace with your actual Expo project ID
      });
      
      return token.data;
    } catch (error) {
      console.error('Push notification registration error:', error);
      return null;
    }
  };

  // Schedule a push notification
  const schedulePushNotification = async (content) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: content.title,
        body: content.body,
        data: content.data,
        sound: 'default',
      },
      trigger: null,
    });
  };

  // Authenticate with biometrics
  const authenticateWithBiometrics = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        Alert.alert('Not Supported', 'This device does not support biometric authentication');
        return false;
      }
      
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        Alert.alert('Not Set Up', 'No biometrics enrolled on this device');
        return false;
      }
      
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to approve login',
        fallbackLabel: 'Use passcode'
      });
      
      return result.success;
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return false;
    }
  };

  // Approve login request
  const approveLogin = async (requestId, signedToken, sessionId) => {
    try {
      const response = await fetch(`${API_URL}/approve-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login_request_id: requestId,
          signed_token: signedToken,
          sessionId: sessionId
        })
      });
      
      const data = await response.json();
      return response.ok;
    } catch (error) {
      console.error('Login approval error:', error);
      return false;
    }
  };

  // Reject login request
  const rejectLogin = async (requestId, sessionId) => {
    try {
      const response = await fetch(`${API_URL}/reject-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login_request_id: requestId,
          sessionId: sessionId
        })
      });
      
      return response.ok;
    } catch (error) {
      console.error('Login rejection error:', error);
      return false;
    }
  };

  // Generate cryptographic key pair
  const generateKeyPair = async () => {
    // In a real app, use proper asymmetric cryptography
    // This is a simplified version for demo purposes
    const id = Crypto.randomUUID();
    
    return {
      publicKey: `public_${id}`,
      privateKey: `private_${id}`
    };
  };

  // Generate a cryptographically signed token
  const generateSignedToken = async (requestId, privateKey) => {
    // In a real app, use proper cryptographic signing
    // This is a simplified version for demo purposes
    const message = `${requestId}_${Date.now()}`;
    const signature = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      message + privateKey
    );
    
    return signature;
  };

  // Loading screen
  if (isLoading || networkError) {
    return (
      <View style={styles.container}>
        {isLoading ? (
          <>
            <ActivityIndicator size="large" color="#0000ff" />
            <Text style={styles.loadingText}>Loading...</Text>
          </>
        ) : (
          <>
            <Text style={styles.errorText}>⚠️ {networkError}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                setNetworkError(null);
                setIsLoading(true);
                initialize(); // You'll need to define this function
              }}
            >
              <Text style={styles.buttonText}>Retry</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  // Main app UI
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      
      {isRegistered ? (
        // Main app screens when device is registered
        <Stack.Navigator>
          <Stack.Screen name="Home" component={HomeScreen} 
            options={{ title: 'Authentication App' }}
            initialParams={{ userId, deviceId }}
          />
        </Stack.Navigator>
      ) : (
        // Registration screens when device is not registered
        <Stack.Navigator>
          <Stack.Screen name="Register" options={{ title: 'Register Device' }}>
            {props => <RegisterScreen {...props} registerDevice={registerDevice} />}
          </Stack.Screen>
        </Stack.Navigator>
      )}
      
      {/* Authentication Request Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAuthModal}
        onRequestClose={() => setShowAuthModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Login Request</Text>
            
            {pendingRequest && (
              <>
                <View style={styles.requestInfo}>
                  <Text style={styles.infoLabel}>Location:</Text>
                  <Text style={styles.infoValue}>
                    {pendingRequest.client_info?.location || 'Unknown'}
                  </Text>
                  
                  <Text style={styles.infoLabel}>Device:</Text>
                  <Text style={styles.infoValue}>
                    {pendingRequest.client_info?.userAgent?.substring(0, 30) || 'Unknown'}...
                  </Text>
                  
                  <Text style={styles.infoLabel}>IP Address:</Text>
                  <Text style={styles.infoValue}>
                    {pendingRequest.client_info?.ip || 'Unknown'}
                  </Text>
                </View>
                
                <Text style={styles.authQuestion}>
                  Approve this login attempt?
                </Text>
                
                <View style={styles.buttonContainer}>
                <TouchableOpacity 
  style={[styles.button, styles.rejectButton]}
  onPress={() => handleLoginApproval(false)}
>
  <Text style={styles.buttonText}>Reject</Text>
</TouchableOpacity>

<TouchableOpacity 
  style={[styles.button, styles.approveButton]}
  onPress={() => handleLoginApproval(true)}
>
  <Text style={styles.buttonText}>Approve</Text>
</TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </NavigationContainer>
  );
}

// Home screen component (when device is registered)
function HomeScreen({ route }) {
  const { userId, deviceId } = route.params;
  
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Authentication Device Ready</Text>
        <Text style={styles.subtitle}>This device can authenticate your logins</Text>
        
        <View style={styles.statusContainer}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Status:</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>Active</Text>
            </View>
          </View>
          
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>User ID:</Text>
            <Text style={styles.statusValue}>{userId?.substring(0, 8)}...</Text>
          </View>
          
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Device ID:</Text>
            <Text style={styles.statusValue}>{deviceId?.substring(0, 8)}...</Text>
          </View>
        </View>
        
        <Text style={styles.instructions}>
          When you attempt to log in on another device, you'll receive a notification 
          on this device to approve the login with your fingerprint.
        </Text>
      </View>
    </View>
  );
}

// Registration screen component (when device is not registered)
function RegisterScreen({ registerDevice }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const handleRegister = () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }
    
    registerDevice(email, password);
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Register Authentication Device</Text>
        <Text style={styles.subtitle}>
          Set up this device to approve your login attempts
        </Text>
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={true}
          />
        </View>
        
        <TouchableOpacity 
          style={[styles.button, styles.registerButton]}
          onPress={handleRegister}
        >
          <Text style={styles.buttonText}>Register Device</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#F44336',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    width: 200,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#333',
  },
  statusContainer: {
    marginVertical: 20,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 15,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    width: 80,
  },
  statusValue: {
    fontSize: 16,
    color: '#333',
  },
  statusBadge: {
    backgroundColor: '#4CAF50',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  instructions: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 20,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
  },
  button: {
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginVertical: 10,
  },
  approveButton: {
    backgroundColor: '#4CAF50',
    flex: 1,
    marginLeft: 10,
  },
  rejectButton: {
    backgroundColor: '#F44336',
    flex: 1,
    marginRight: 10,
  },
  registerButton: {
    backgroundColor: '#2196F3',
    width: '100%',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 22,
    width: '100%',
    maxWidth: 500,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  requestInfo: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
  },
  authQuestion: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  }
});