import { useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import NotificationService from '../services/notificationService';

export const useNotifications = () => {
  const [unreadCounts, setUnreadCounts] = useState({
    unreadPostsCount: 0,
    unreadMessagesCount: 0,
  });
  const [isInitialized, setIsInitialized] = useState(false);

  const initializeNotifications = useCallback(async () => {
    if (isInitialized) return;

    try {
      console.log('Initializing notifications...');
      
      // Initialize the notification service
      await NotificationService.initialize(
        (notification) => {
          console.log('Notification received:', notification);
          refreshUnreadCounts();
        },
        (response) => {
          console.log('Notification tapped:', response);
          // Handle navigation here if needed
        }
      );

      // Load initial data
      await refreshUnreadCounts();
      setIsInitialized(true);
      
      console.log('Notifications initialized successfully');
    } catch (error) {
      console.error('Error initializing notifications:', error);
      setIsInitialized(true);
    }
  }, [isInitialized]);

const refreshUnreadCounts = useCallback(async () => {
  try {
    const counts = await NotificationService.getUnreadCounts();
    setUnreadCounts(counts);
    await NotificationService.updateBadgeCount();
  } catch (error) {
    console.error('Error refreshing unread counts:', error);
  }
}, []);

  const markPostsAsRead = async () => {
    try {
      const success = await NotificationService.markPostsAsRead();
      if (success) {
        setUnreadCounts(prev => ({
          ...prev,
          unreadPostsCount: 0
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error marking posts as read:', error);
      return false;
    }
  };

  const markConversationAsRead = async (conversationId) => {
    try {
      const success = await NotificationService.markConversationAsRead(conversationId);
      if (success) {
        await refreshUnreadCounts();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error marking conversation as read:', error);
      return false;
    }
  };

  const handleLogout = async () => {
    try {
      await NotificationService.removePushToken();
      setUnreadCounts({
        unreadPostsCount: 0,
        unreadMessagesCount: 0,
      });
      setIsInitialized(false);
    } catch (error) {
      console.error('Error during notification logout cleanup:', error);
    }
  };

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active' && isInitialized) {
        refreshUnreadCounts();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isInitialized]);

  const totalBadgeCount = unreadCounts.unreadPostsCount + unreadCounts.unreadMessagesCount;

  return {
    unreadCounts,
    totalBadgeCount,
    isInitialized,
    initializeNotifications,
    refreshUnreadCounts,
    markPostsAsRead,
    markConversationAsRead,
    handleLogout,
  };
};