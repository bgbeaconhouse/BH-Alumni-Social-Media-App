import { useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';

const SECURE_STORE_KEYS = {
  AUTH_TOKEN: 'authToken',
  REMEMBER_CREDENTIALS: 'rememberCredentials',
  SAVED_USERNAME: 'savedUsername',
  SAVED_PASSWORD: 'savedPassword',
};

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const router = useRouter();

  // Secure storage helper functions
  const getSecureData = async (key) => {
    try {
      const value = await SecureStore.getItemAsync(key);
      return value;
    } catch (error) {
      console.error(`❌ Failed to get ${key} from SecureStore:`, error);
      return null;
    }
  };

  const setSecureData = async (key, value) => {
    try {
      await SecureStore.setItemAsync(key, value);
      return true;
    } catch (error) {
      console.error(`❌ Failed to store ${key} in SecureStore:`, error);
      return false;
    }
  };

  const removeSecureData = async (key) => {
    try {
      await SecureStore.deleteItemAsync(key);
      return true;
    } catch (error) {
      console.error(`❌ Failed to remove ${key} from SecureStore:`, error);
      return false;
    }
  };

  // JWT token utilities
  const decodeToken = (token) => {
    try {
      if (!token || typeof token !== 'string') {
        return null;
      }

      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('❌ Error decoding token:', error);
      return null;
    }
  };

  const isTokenExpired = (token) => {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) {
      console.log('⚠️ Token has no expiration or is invalid');
      return true;
    }
    
    const currentTime = Math.floor(Date.now() / 1000);
    const isExpired = decoded.exp < currentTime;
    
    if (isExpired) {
      const expiredMinutesAgo = Math.floor((currentTime - decoded.exp) / 60);
      console.log(`⏰ Token expired ${expiredMinutesAgo} minutes ago`);
    } else {
      const minutesUntilExpiry = Math.floor((decoded.exp - currentTime) / 60);
      console.log(`⏳ Token expires in ${minutesUntilExpiry} minutes`);
    }
    
    return isExpired;
  };

  // Backend token validation
  const validateTokenWithBackend = async (token) => {
    try {
      console.log('🔍 Validating token with backend...');
      const response = await fetch('https://bh-alumni-social-media-app.onrender.com/api/auth/validate', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const userData = await response.json();
        console.log('✅ Backend token validation successful');
        return userData;
      } else {
        const errorText = await response.text();
        console.log('❌ Backend token validation failed:', response.status, errorText);
        return null;
      }
    } catch (error) {
      console.error('❌ Token validation network error:', error);
      return null;
    }
  };

  // Auto-login function
  const attemptAutoLogin = async () => {
    try {
      console.log('🔄 Attempting auto-login...');
      
      const rememberCredentials = await getSecureData(SECURE_STORE_KEYS.REMEMBER_CREDENTIALS);
      if (rememberCredentials !== 'true') {
        console.log('🔒 Auto-login disabled by user');
        return false;
      }

      const username = await getSecureData(SECURE_STORE_KEYS.SAVED_USERNAME);
      const password = await getSecureData(SECURE_STORE_KEYS.SAVED_PASSWORD);

      if (!username || !password) {
        console.log('❌ No saved credentials found for auto-login');
        return false;
      }

      console.log('🚀 Attempting auto-login for user:', username);
      
      const response = await fetch('https://bh-alumni-social-media-app.onrender.com/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.token) {
          // Store the new token
          await setSecureData(SECURE_STORE_KEYS.AUTH_TOKEN, result.token);
          
          // Decode token to get user info
          const decoded = decodeToken(result.token);
          if (decoded) {
            const userData = {
              id: decoded.id,
              username: decoded.username,
              firstName: decoded.firstName,
              lastName: decoded.lastName,
            };
            
            setUser(userData);
            setIsAuthenticated(true);
            console.log('✅ Auto-login successful for:', username);
            return true;
          }
        }
      } else {
        const errorData = await response.json();
        console.log('❌ Auto-login failed:', errorData.message);
      }

      return false;

    } catch (error) {
      console.error('❌ Auto-login error:', error);
      return false;
    }
  };

  // Clear authentication data
  const clearAuth = useCallback(async () => {
    try {
      console.log('🧹 Clearing authentication data...');
      await removeSecureData(SECURE_STORE_KEYS.AUTH_TOKEN);
      setIsAuthenticated(false);
      setUser(null);
      console.log('✅ Auth data cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing auth data:', error);
    }
  }, []);

  // Main authentication check function
  const checkAuthStatus = useCallback(async () => {
    console.log('🔍 Checking authentication status...');
    setIsLoading(true);

    try {
      // Get token from secure storage
      const token = await getSecureData(SECURE_STORE_KEYS.AUTH_TOKEN);
      
      if (!token) {
        console.log('❌ No token found');
        setIsAuthenticated(false);
        setUser(null);
        setIsLoading(false);
        return false;
      }

      // Check if token is structurally valid and not expired
      if (isTokenExpired(token)) {
        console.log('⏰ Token expired, attempting auto-login...');
        const autoLoginSuccess = await attemptAutoLogin();
        
        if (autoLoginSuccess) {
          setIsLoading(false);
          return true;
        } else {
          await clearAuth();
          setIsLoading(false);
          return false;
        }
      }

      // Validate token with backend
      const userData = await validateTokenWithBackend(token);
      
      if (userData) {
        console.log('✅ Authentication successful for user:', userData.username || userData.id);
        setUser(userData);
        setIsAuthenticated(true);
        setIsLoading(false);
        return true;
      } else {
        console.log('❌ Token validation failed, clearing auth data');
        await clearAuth();
        setIsLoading(false);
        return false;
      }

    } catch (error) {
      console.error('❌ Error during auth check:', error);
      await clearAuth();
      setIsLoading(false);
      return false;
    }
  }, [clearAuth]);

  // Login function
  const login = async (username, password, rememberMe = false) => {
    try {
      console.log('🚀 Attempting login for user:', username);
      console.log('💾 Remember me:', rememberMe);
      
      const response = await fetch('https://bh-alumni-social-media-app.onrender.com/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.log('❌ Login failed:', errorData.message);
        throw new Error(errorData.message || 'Login failed');
      }

      const result = await response.json();
      
      if (!result.token) {
        throw new Error('No token received from server');
      }

      // Store the token
      const tokenStored = await setSecureData(SECURE_STORE_KEYS.AUTH_TOKEN, result.token);
      if (!tokenStored) {
        throw new Error('Failed to store authentication token');
      }

      // Handle remember me preferences
      if (rememberMe) {
        await setSecureData(SECURE_STORE_KEYS.REMEMBER_CREDENTIALS, 'true');
        await setSecureData(SECURE_STORE_KEYS.SAVED_USERNAME, username);
        await setSecureData(SECURE_STORE_KEYS.SAVED_PASSWORD, password);
        console.log('💾 Credentials saved for auto-login');
      } else {
        // Clear remember me data if not selected
        await removeSecureData(SECURE_STORE_KEYS.REMEMBER_CREDENTIALS);
        await removeSecureData(SECURE_STORE_KEYS.SAVED_USERNAME);
        await removeSecureData(SECURE_STORE_KEYS.SAVED_PASSWORD);
        console.log('🗑️ Auto-login disabled, credentials not saved');
      }

      // Decode token to get user info
      const decoded = decodeToken(result.token);
      if (decoded) {
        const userData = {
          id: decoded.id,
          username: decoded.username,
          firstName: decoded.firstName,
          lastName: decoded.lastName,
        };
        setUser(userData);
        console.log('👤 User data set:', userData.username || userData.id);
      }

      setIsAuthenticated(true);
      console.log('✅ Login successful');
      
      return { 
        success: true, 
        message: result.message || 'Login successful' 
      };

    } catch (error) {
      console.error('❌ Login error:', error);
      return { 
        success: false, 
        message: error.message || 'Login failed' 
      };
    }
  };

  // Get saved credentials for form auto-fill
  const getSavedCredentials = async () => {
    try {
      const rememberCredentials = await getSecureData(SECURE_STORE_KEYS.REMEMBER_CREDENTIALS);
      
      if (rememberCredentials === 'true') {
        const username = await getSecureData(SECURE_STORE_KEYS.SAVED_USERNAME);
        const password = await getSecureData(SECURE_STORE_KEYS.SAVED_PASSWORD);
        
        return {
          username: username || '',
          password: password || '',
          rememberMe: true
        };
      }
      
      return {
        username: '',
        password: '',
        rememberMe: false
      };
    } catch (error) {
      console.error('❌ Error getting saved credentials:', error);
      return {
        username: '',
        password: '',
        rememberMe: false
      };
    }
  };

  // Logout function
  const logout = async (clearSavedCredentials = false) => {
    try {
      console.log('👋 Logging out user...');
      
      // Always remove the current token
      await removeSecureData(SECURE_STORE_KEYS.AUTH_TOKEN);
      
      // Optionally clear saved credentials
      if (clearSavedCredentials) {
        await removeSecureData(SECURE_STORE_KEYS.REMEMBER_CREDENTIALS);
        await removeSecureData(SECURE_STORE_KEYS.SAVED_USERNAME);
        await removeSecureData(SECURE_STORE_KEYS.SAVED_PASSWORD);
        console.log('🗑️ Saved credentials cleared');
      }

      // Clear state
      setIsAuthenticated(false);
      setUser(null);
      
      console.log('✅ Logout completed');
      
      // Navigate to login screen
      router.replace('/');
      
    } catch (error) {
      console.error('❌ Logout error:', error);
      // Even if there's an error, clear the state and navigate
      setIsAuthenticated(false);
      setUser(null);
      router.replace('/');
    }
  };

  // Get current auth token
  const getAuthToken = async () => {
    try {
      const token = await getSecureData(SECURE_STORE_KEYS.AUTH_TOKEN);
      
      // If we have a token, check if it's expired
      if (token && !isTokenExpired(token)) {
        return token;
      } else if (token) {
        console.log('⚠️ Token expired, attempting auto-login...');
        const autoLoginSuccess = await attemptAutoLogin();
        if (autoLoginSuccess) {
          // Get the new token after auto-login
          return await getSecureData(SECURE_STORE_KEYS.AUTH_TOKEN);
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error getting auth token:', error);
      return null;
    }
  };

  // Initialize authentication on app start
  useEffect(() => {
    let mounted = true;
    
    const initAuth = async () => {
      if (mounted) {
        await checkAuthStatus();
      }
    };
    
    initAuth();
    
    return () => {
      mounted = false;
    };
  }, [checkAuthStatus]);

  // Debug function for troubleshooting
  const debugAuthState = async () => {
    console.log('🐛 === AUTH DEBUG INFO ===');
    console.log('📊 isAuthenticated:', isAuthenticated);
    console.log('⏳ isLoading:', isLoading);
    console.log('👤 user:', user);
    
    const token = await getSecureData(SECURE_STORE_KEYS.AUTH_TOKEN);
    console.log('🎫 Has token:', !!token);
    
    if (token) {
      const decoded = decodeToken(token);
      if (decoded) {
        console.log('⏰ Token expires:', new Date(decoded.exp * 1000));
        console.log('❗ Is expired:', isTokenExpired(token));
      }
    }
    
    const rememberMe = await getSecureData(SECURE_STORE_KEYS.REMEMBER_CREDENTIALS);
    console.log('💾 Remember me enabled:', rememberMe === 'true');
    
    console.log('🐛 === END DEBUG INFO ===');
  };

  return {
    // State
    isAuthenticated,
    isLoading,
    user,
    
    // Functions
    login,
    logout,
    checkAuthStatus,
    getSavedCredentials,
    getAuthToken,
    clearAuth,
    debugAuthState, // For debugging
  };
};