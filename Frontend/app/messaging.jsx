
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, Alert, Platform, StatusBar } from 'react-native';
import React, { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Link, useRouter } from 'expo-router';
import { useNotifications } from '../hooks/useNotifications';

const Messaging = () => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  // NEW: Use notification context
  const { unreadCounts, refreshUnreadCounts } = useNotifications();

  // Function to retrieve the JWT token from SecureStore
  const getToken = async () => {
    try {
      const token = await SecureStore.getItemAsync('authToken');
      return token;
    } catch (e) {
      console.error("Failed to load token from secure storage", e);
      return null;
    }
  };

  // Function to fetch conversations from the backend
  const fetchConversations = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();

      if (!token) {
        setError("Authentication token not found. Please log in.");
        setLoading(false);
        return;
      }

      const response = await fetch('https://bh-alumni-social-media-app.onrender.com/api/conversations', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch conversations');
      }

      const data = await response.json();
      setConversations(data);
    } catch (err) {
      console.error("Error fetching conversations:", err);
      setError(err.message || "An unexpected error occurred while fetching conversations.");
      Alert.alert("Error", err.message || "Could not load conversations.");
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    fetchConversations();
    // Refresh unread counts when messaging screen loads
    refreshUnreadCounts();
  }, [refreshUnreadCounts]);

  // NEW: Handle conversation navigation with read marking
  const handleConversationPress = (conversationId) => {
    router.push({
      pathname: '/seeMessages',
      params: { conversationId: conversationId },
    });
  };

  const handleNewMessagePress = () => {
    router.push('/newMessage');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <ActivityIndicator size="large" color="#2c3e50" />
        <Text style={styles.loadingText}>Loading conversations...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <Text style={styles.errorText}>Unable to load messages</Text>
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
          {/* NEW: Show unread count badge */}
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

      {/* DEBUG BUTTON */}
      <TouchableOpacity 
        style={styles.debugButton} 
        onPress={resetUnreadCounts}
      >
        <Text style={styles.debugButtonText}>
          🔄 Reset Unread Counts (DEBUG)
        </Text>
      </TouchableOpacity>

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
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.conversationItem}
              onPress={() => handleConversationPress(item.id)}
            >
              <View style={styles.conversationContent}>
                <View style={styles.conversationHeader}>
                  <Text style={styles.conversationName}>
                    {item.name ? item.name : item.participants.map(p => p.firstName).join(', ')}
                  </Text>
                  {/* NEW: Show unread indicator for individual conversations if needed */}
                  {/* You could add individual conversation unread counts here if you enhance the backend */}
                </View>
                {item.lastMessage ? (
                  <Text style={styles.lastMessage}>
                    {item.lastMessage.sender.firstName}: {item.lastMessage.content ? item.lastMessage.content : 'Attachment'}
                  </Text>
                ) : (
                  <Text style={styles.noMessage}>No messages yet</Text>
                )}
              </View>
            </TouchableOpacity>
          )}
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
  // NEW: Unread badge styles
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
  // DEBUG BUTTON STYLES
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
  conversationContent: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
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
  },
  lastMessage: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '300',
    letterSpacing: 0.5,
    lineHeight: 18,
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