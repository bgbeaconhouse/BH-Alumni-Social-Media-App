import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, Alert, Platform, StatusBar } from 'react-native';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Link, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../hooks/useAuth';

const Messaging = () => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  // NEW: WebSocket connection for real-time updates
  const websocket = useRef(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Use notification context and auth hook
  const { unreadCounts, refreshUnreadCounts } = useNotifications();
  const { isAuthenticated, isLoading, checkAuthStatus, user, getAuthToken } = useAuth();

  // Enhanced function to retrieve JWT token with better auth handling
  const getToken = async () => {
    try {
      console.log("🎫 Getting auth token...");
      
      // Use the auth hook's getAuthToken method which handles expiration
      const token = await getAuthToken();
      
      if (!token) {
        console.log("❌ No token available from auth hook");
        return null;
      }

      console.log("✅ Token retrieved successfully from auth hook");
      return token;
      
    } catch (e) {
      console.error("❌ Failed to get token:", e);
      return null;
    }
  };

  // NEW: Get current user ID from token
  const getUserId = useCallback(async () => {
    const token = await getToken();
    if (token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const payload = JSON.parse(jsonPayload);
        setCurrentUserId(payload.id);
        return payload.id;
      } catch (e) {
        console.error("Error decoding token:", e);
        setCurrentUserId(null);
        return null;
      }
    }
    return null;
  }, []);

  // Enhanced fetch conversations with proper auth handling
  const fetchConversations = async () => {
    console.log("📱 Starting fetchConversations...");
    setLoading(true);
    setError(null);

    try {
      console.log("🔍 Current auth state:", { isAuthenticated, isLoading, hasUser: !!user });
      
      // If auth is still loading, wait a bit
      if (isLoading) {
        console.log("⏳ Auth still loading, waiting...");
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Get token using the auth hook method
      const token = await getToken();
      if (!token) {
        console.log("❌ No valid token available");
        // Only show error if we're definitely not authenticated and not loading
        if (!isLoading && !isAuthenticated) {
          setError("Please log in to view your messages");
        }
        setLoading(false);
        return;
      }

      console.log("🚀 Making API request to fetch conversations...");
      const response = await fetch('https://bh-alumni-social-media-app.onrender.com/api/conversations', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log("📡 API response status:", response.status);

      if (response.status === 401 || response.status === 403) {
        console.log("❌ Authentication failed (401/403), refreshing auth...");
        
        // Try to refresh auth status
        const authRefreshSuccess = await checkAuthStatus();
        if (!authRefreshSuccess) {
          Alert.alert(
            "Session Expired",
            "Your session has expired. Please log in again.",
            [
              {
                text: "Go to Login",
                onPress: () => router.replace('/login')
              }
            ]
          );
          return;
        } else {
          // If auth refresh worked, try the request again
          console.log("🔄 Auth refreshed, retrying request...");
          fetchConversations();
          return;
        }
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch conversations');
      }

      const data = await response.json();
      console.log('🔔 Conversations with unread counts:', data.map(c => ({
        id: c.id, 
        name: c.participants?.length ? c.participants.map(p => p.firstName).join(', ') : 'Unknown',
        unreadCount: c.unreadCount || 0
      })));
      
      setConversations(data);
      console.log("✅ Conversations loaded successfully");
      
    } catch (err) {
      console.error("❌ Error fetching conversations:", err);
      setError(err.message || "An unexpected error occurred while fetching conversations.");
      
      // Only show alert for non-auth related errors
      if (!err.message?.includes('auth') && !err.message?.includes('token')) {
        Alert.alert("Error", err.message || "Could not load conversations.");
      }
    } finally {
      setLoading(false);
    }
  };

  // NEW: WebSocket connection setup
  const connectWebSocket = useCallback(async () => {
    const token = await getToken();
    const userId = await getUserId();
    
    if (token && userId) {
      try {
        websocket.current = new WebSocket(`wss://bh-alumni-social-media-app.onrender.com/?token=${token}`);

        websocket.current.onopen = () => {
          console.log("🔌 Messaging WebSocket connected");
        };

        websocket.current.onmessage = (event) => {
          try {
            const parsedMessage = JSON.parse(event.data);
            
            if (parsedMessage.type === 'newMessage') {
              const message = parsedMessage.message;
              console.log("📨 New message received in messaging list:", message.conversationId);
              
              // Only refresh if the message is not from the current user
              if (message.senderId !== userId) {
                // Refresh conversations to get updated unread counts
                fetchConversations();
                // Also refresh global unread counts
                refreshUnreadCounts();
              }
            }
          } catch (e) {
            console.error("Error parsing WebSocket message:", e);
          }
        };

        websocket.current.onclose = () => {
          console.log("🔌 Messaging WebSocket disconnected. Attempting to reconnect...");
          setTimeout(connectWebSocket, 3000);
        };

        websocket.current.onerror = (error) => {
          console.error("🔌 Messaging WebSocket error:", error);
          websocket.current?.close();
        };
      } catch (error) {
        console.error("Error connecting to WebSocket:", error);
      }
    }
  }, [getUserId, refreshUnreadCounts]);

  // DEBUG: Reset unread counts function
  const resetUnreadCounts = async () => {
    try {
      const token = await getToken();
      console.log('🔄 Resetting unread counts...');
      
      const response = await fetch('https://bh-alumni-social-media-app.onrender.com/api/notifications/reset-unread-counts', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const result = await response.json();
      console.log('✅ Reset response:', result);
      
      // Refresh the page data
      fetchConversations();
      refreshUnreadCounts();
      
      Alert.alert('Debug', 'Unread counts reset successfully!');
    } catch (error) {
      console.error('❌ Error resetting unread counts:', error);
      Alert.alert('Error', 'Failed to reset unread counts');
    }
  };

  // Enhanced useEffect with proper auth handling - FIXED DEPENDENCIES
  useEffect(() => {
    let isMounted = true;

    const initializeComponent = async () => {
      console.log("🎬 Initializing Messaging component...");
      console.log("📊 Initial auth state:", { isAuthenticated, isLoading, hasUser: !!user });
      
      if (!isMounted) return;

      // Wait for auth to finish loading
      if (isLoading) {
        console.log("⏳ Auth still loading, waiting for completion...");
        return;
      }

      // If not loading and not authenticated, don't proceed
      if (!isAuthenticated) {
        console.log("❌ User not authenticated after loading completed");
        setError("Please log in to view your messages");
        setLoading(false);
        return;
      }

      // Proceed with initialization if authenticated
      if (isMounted && isAuthenticated) {
        console.log("✅ User authenticated, initializing component...");
        await getUserId();
        await fetchConversations();
        refreshUnreadCounts();
        connectWebSocket();
      }
    };

    initializeComponent();

    // Cleanup function
    return () => {
      console.log("🧹 Messaging component cleanup");
      isMounted = false;
      if (websocket.current && websocket.current.readyState === WebSocket.OPEN) {
        websocket.current.close();
      }
    };
  }, [isAuthenticated, isLoading]); // Only depend on auth state, not functions

  // Enhanced focus effect with better auth handling - FIXED INFINITE LOOP
  useFocusEffect(
    useCallback(() => {
      console.log('📱 Messaging screen focused');
      
      // Only refresh on focus if we have conversations and user is authenticated
      if (isAuthenticated && !isLoading && conversations.length === 0) {
        console.log('🔄 No conversations loaded, fetching on focus...');
        fetchConversations();
        refreshUnreadCounts();
      }
      
      // Only reconnect WebSocket if it's not connected
      if (isAuthenticated && (!websocket.current || websocket.current.readyState !== WebSocket.OPEN)) {
        console.log('🔌 WebSocket not connected, reconnecting...');
        connectWebSocket();
      }
    }, [isAuthenticated, isLoading, conversations.length]) // Removed functions from dependencies
  );

  // Handle conversation navigation with read marking
  const handleConversationPress = (conversationId) => {
    router.push({
      pathname: '/seeMessages',
      params: { conversationId: conversationId },
    });
  };

  const handleNewMessagePress = () => {
    router.push('/newMessage');
  };

  // NEW: Render conversation item with highlighting
  const renderConversationItem = ({ item }) => {
    const hasUnreadMessages = item.unreadCount > 0;
    const participantNames = item.name ? item.name : item.participants.map(p => p.firstName).join(', ');
    
    return (
      <TouchableOpacity 
        style={[
          styles.conversationItem,
          hasUnreadMessages && styles.conversationItemUnread
        ]}
        onPress={() => handleConversationPress(item.id)}
      >
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={[
              styles.conversationName,
              hasUnreadMessages && styles.conversationNameUnread
            ]}>
              {participantNames}
            </Text>
            {/* NEW: Show unread count badge */}
            {hasUnreadMessages && (
              <View style={styles.conversationUnreadBadge}>
                <Text style={styles.conversationUnreadText}>
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
          {item.lastMessage ? (
            <Text style={[
              styles.lastMessage,
              hasUnreadMessages && styles.lastMessageUnread
            ]}>
              {item.lastMessage.sender.firstName}: {item.lastMessage.content ? item.lastMessage.content : 'Attachment'}
            </Text>
          ) : (
            <Text style={styles.noMessage}>No messages yet</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Show loading state while auth is being determined
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <ActivityIndicator size="large" color="#2c3e50" />
        <Text style={styles.loadingText}>Checking authentication...</Text>
      </View>
    );
  }

  // Show loading for conversations
  if (loading && conversations.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <ActivityIndicator size="large" color="#2c3e50" />
        <Text style={styles.loadingText}>Loading conversations...</Text>
      </View>
    );
  }

  // Enhanced error display for authentication issues
  if (error && (error.includes('Authentication') || error.includes('log in'))) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <Text style={styles.logo}>BH</Text>
        <Text style={styles.errorText}>Authentication Required</Text>
        <Text style={styles.errorSubtext}>Please log in to view your messages</Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={() => router.replace('/login')}
        >
          <Text style={styles.retryButtonText}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <Text style={styles.errorText}>Unable to load messages</Text>
        <Text style={styles.errorSubtext}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchConversations}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerButton}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.push('/home')}>
            <Text style={styles.headerButtonText}>← Home</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Messages</Text>
          {/* Show total unread count badge */}
          {unreadCounts.unreadMessagesCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {unreadCounts.unreadMessagesCount > 99 ? '99+' : unreadCounts.unreadMessagesCount}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.headerButton}>
          <TouchableOpacity style={styles.newButton} onPress={handleNewMessagePress}>
            <Text style={styles.headerButtonText}>New</Text>
          </TouchableOpacity>
        </View>
      </View>


      {conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyContent}>
            <Text style={styles.logo}>BH</Text>
            <Text style={styles.emptyTitle}>No Messages Yet</Text>
            <Text style={styles.emptySubtitle}>Start a conversation with your community</Text>
            <TouchableOpacity style={styles.newMessageButton} onPress={handleNewMessagePress}>
              <Text style={styles.newMessageButtonText}>Send First Message</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.footer}>
            <Text style={styles.footerText}>Beacon House • Connected in recovery</Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderConversationItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={() => {
            fetchConversations();
            refreshUnreadCounts();
          }}
        />
      )}
    </View>
  );
};

export default Messaging;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: Platform.OS === 'ios' ? 30 : 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  headerButton: {
    minWidth: Platform.OS === 'ios' ? 60 : 80,
    alignItems: Platform.OS === 'ios' ? 'flex-start' : 'center',
  },
  backButton: {
    alignItems: 'flex-start',
  },
  newButton: {
    alignItems: 'flex-end',
  },
  headerButtonText: {
    color: '#7f8c8d',
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '100',
    color: '#2c3e50',
    letterSpacing: 2,
  },
  // Total unread badge styles
  unreadBadge: {
    backgroundColor: '#e74c3c',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  // DEBUG BUTTON STYLES - Remove in production
  debugButton: {
    backgroundColor: '#e74c3c',
    padding: 15,
    margin: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  debugButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    color: '#e74c3c',
    fontWeight: '300',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '300',
    textAlign: 'center',
    marginBottom: 30,
    letterSpacing: 0.5,
  },
  retryButton: {
    backgroundColor: '#2c3e50',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  emptyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logo: {
    fontSize: 48,
    fontWeight: '100',
    color: '#2c3e50',
    letterSpacing: 8,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '300',
    color: '#2c3e50',
    marginBottom: 8,
    letterSpacing: 1,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '300',
    textAlign: 'center',
    marginBottom: 40,
    letterSpacing: 0.5,
  },
  newMessageButton: {
    backgroundColor: '#2c3e50',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  newMessageButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  listContent: {
    paddingHorizontal: 30,
    paddingTop: 20,
    paddingBottom: 40,
  },
  conversationItem: {
    marginBottom: 1,
  },
  // NEW: Unread conversation styling
  conversationItemUnread: {
    backgroundColor: '#f8f9fa', // Light highlight background
    borderRadius: 8,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#3498db', // Blue accent line for unread conversations
  },
  conversationContent: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
    paddingHorizontal: 16,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '300',
    color: '#2c3e50',
    letterSpacing: 0.5,
    flex: 1,
  },
  // NEW: Bold styling for unread conversations
  conversationNameUnread: {
    fontWeight: '600',
    color: '#1a252f',
  },
  // NEW: Per-conversation unread badge
  conversationUnreadBadge: {
    backgroundColor: '#e74c3c',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  conversationUnreadText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '300',
    letterSpacing: 0.5,
    lineHeight: 18,
  },
  // NEW: Styling for unread last message
  lastMessageUnread: {
    fontWeight: '500',
    color: '#5a6c7d',
  },
  noMessage: {
    fontSize: 14,
    color: '#bdc3c7',
    fontWeight: '300',
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },
  footer: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#bdc3c7',
    fontWeight: '300',
    letterSpacing: 1,
  },
});