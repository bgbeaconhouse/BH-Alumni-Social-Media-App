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

  // Get stored data securely
  const getSecureData = async (key) => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error(`Failed to get ${key} from SecureStore:`, error);
      return null;
    }
  };

  // Store data securely
  const setSecureData = async (key, value) => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error(`Failed to store ${key} in SecureStore:`, error);
    }
  };

  // Remove data securely
  const removeSecureData = async (key) => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error(`Failed to remove ${key} from SecureStore:`, error);
    }
  };

  // Decode JWT token to get user info
  const decodeToken = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  // Check if token is expired
  const isTokenExpired = (token) => {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) return true;
    
    const currentTime = Date.now() / 1000;
    return decoded.exp < currentTime;
  };

  // Validate token with backend
  const validateToken = async (token) => {
    try {
      const response = await fetch('https://bh-alumni-social-media-app.onrender.com/api/auth/validate', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const userData = await response.json();
        return userData;
      }
      return null;
    } catch (error) {
      console.error('Token validation failed:', error);
      return null;
    }
  };

  // Check authentication status on app startup
  const checkAuthStatus = useCallback(async () => {
    console.log('🔍 Checking authentication status...');
    setIsLoading(true);

    try {
      const token = await getSecureData(SECURE_STORE_KEYS.AUTH_TOKEN);
      
      if (!token) {
        console.log('❌ No token found');
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      // Check if token is expired
      if (isTokenExpired(token)) {
        console.log('⏰ Token expired, attempting auto-login...');
        const autoLoginSuccess = await attemptAutoLogin();
        
        if (!autoLoginSuccess) {
          await clearAuth();
          setIsAuthenticated(false);
        }
        
        setIsLoading(false);
        return;
      }

      // Validate token with backend
      console.log('🔍 Validating token with backend...');
      const userData = await validateToken(token);
      
      if (userData) {
        console.log('✅ Token valid, user authenticated');
        setUser(userData);
        setIsAuthenticated(true);
      } else {
        console.log('❌ Token invalid, clearing auth...');
        await clearAuth();
        setIsAuthenticated(false);
      }

    } catch (error) {
      console.error('Error checking auth status:', error);
      await clearAuth();
      setIsAuthenticated(false);
    }

    setIsLoading(false);
  }, []);

  // Attempt automatic login with saved credentials
  const attemptAutoLogin = async () => {
    try {
      const rememberCredentials = await getSecureData(SECURE_STORE_KEYS.REMEMBER_CREDENTIALS);
      
      if (rememberCredentials !== 'true') {
        console.log('🔒 Auto-login disabled by user');
        return false;
      }

      const username = await getSecureData(SECURE_STORE_KEYS.SAVED_USERNAME);
      const password = await getSecureData(SECURE_STORE_KEYS.SAVED_PASSWORD);

      if (!username || !password) {
        console.log('🔒 No saved credentials found');
        return false;
      }

      console.log('🔄 Attempting auto-login...');
      
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
          await setSecureData(SECURE_STORE_KEYS.AUTH_TOKEN, result.token);
          
          const decoded = decodeToken(result.token);
          if (decoded) {
            setUser({ id: decoded.id, username: decoded.username });
            setIsAuthenticated(true);
            console.log('✅ Auto-login successful');
            return true;
          }
        }
      }

      console.log('❌ Auto-login failed');
      return false;

    } catch (error) {
      console.error('Auto-login error:', error);
      return false;
    }
  };

  // Login function
  const login = async (username, password, rememberMe = false) => {
    try {
      const response = await fetch('https://bh-alumni-social-media-app.onrender.com/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }

      const result = await response.json();
      
      if (!result.token) {
        throw new Error('No token received from server');
      }

      // Store the token
      await setSecureData(SECURE_STORE_KEYS.AUTH_TOKEN, result.token);

      // Store credentials if remember me is enabled
      if (rememberMe) {
        await setSecureData(SECURE_STORE_KEYS.REMEMBER_CREDENTIALS, 'true');
        await setSecureData(SECURE_STORE_KEYS.SAVED_USERNAME, username);
        await setSecureData(SECURE_STORE_KEYS.SAVED_PASSWORD, password);
        console.log('💾 Credentials saved for auto-login');
      } else {
        await removeSecureData(SECURE_STORE_KEYS.REMEMBER_CREDENTIALS);
        await removeSecureData(SECURE_STORE_KEYS.SAVED_USERNAME);
        await removeSecureData(SECURE_STORE_KEYS.SAVED_PASSWORD);
      }

      // Decode token to get user info
      const decoded = decodeToken(result.token);
      if (decoded) {
        setUser({ id: decoded.id, username: decoded.username });
      }

      setIsAuthenticated(true);
      console.log('✅ Login successful');
      
      return { success: true, message: result.message };

    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: error.message };
    }
  };

  // Get saved credentials for auto-fill
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
      console.error('Error getting saved credentials:', error);
      return {
        username: '',
        password: '',
        rememberMe: false
      };
    }
  };

  // Clear all authentication data
  const clearAuth = async () => {
    try {
      await removeSecureData(SECURE_STORE_KEYS.AUTH_TOKEN);
      // Note: We don't clear saved credentials here unless user chooses to
      setIsAuthenticated(false);
      setUser(null);
      console.log('🧹 Auth data cleared');
    } catch (error) {
      console.error('Error clearing auth:', error);
    }
  };

  // Logout function
  const logout = async (clearSavedCredentials = false) => {
    try {
      await removeSecureData(SECURE_STORE_KEYS.AUTH_TOKEN);
      
      if (clearSavedCredentials) {
        await removeSecureData(SECURE_STORE_KEYS.REMEMBER_CREDENTIALS);
        await removeSecureData(SECURE_STORE_KEYS.SAVED_USERNAME);
        await removeSecureData(SECURE_STORE_KEYS.SAVED_PASSWORD);
        console.log('🧹 Saved credentials cleared');
      }

      setIsAuthenticated(false);
      setUser(null);
      
      console.log('👋 User logged out');
      
      // Navigate to login screen
      router.replace('/');
      
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Get current auth token
  const getAuthToken = async () => {
    return await getSecureData(SECURE_STORE_KEYS.AUTH_TOKEN);
  };

  // Initialize auth check on mount
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  return {
    isAuthenticated,
    isLoading,
    user,
    login,
    logout,
    checkAuthStatus,
    getSavedCredentials,
    getAuthToken,
    clearAuth,
  };
};