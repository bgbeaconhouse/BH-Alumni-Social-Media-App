import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  static notificationListener = null;
  static responseListener = null;

  /**
   * Initialize notification service
   * @param {Function} onNotificationReceived - Callback when notification is received
   * @param {Function} onNotificationTapped - Callback when notification is tapped
   */
  static async initialize(onNotificationReceived, onNotificationTapped) {
    try {
      // Register for push notifications
      const token = await this.registerForPushNotifications();
      
      if (token) {
        // Send token to backend
        await this.sendTokenToBackend(token);
      }

      // Set up notification listeners
      this.setupNotificationListeners(onNotificationReceived, onNotificationTapped);

      return token;
    } catch (error) {
      console.error('Error initializing notifications:', error);
      return null;
    }
  }

  /**
   * Register for push notifications and get token - ENHANCED VERSION
   */
  static async registerForPushNotifications() {
    try {
      let token;

      if (!Device.isDevice) {
        console.log('Must use physical device for Push Notifications');
        return null;
      }

      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Ask for permission if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowDisplayInCarPlay: true,
            allowCriticalAlerts: false,
            provideAppNotificationSettings: true,
            allowProvisional: false,
            allowAnnouncements: true,
          },
        });
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return null;
      }

      // Get the token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      
      if (!projectId) {
        console.error('Project ID not found');
        return null;
      }

      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

      // Configure notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          enableLights: true,
          enableVibrate: true,
          showBadge: true,
        });
      }

      return token;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  }

  /**
   * Set up notification listeners - ENHANCED VERSION
   */
  static setupNotificationListeners(onNotificationReceived, onNotificationTapped) {
    // Listener for notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      // Update badge count immediately
      this.updateBadgeFromNotification(notification);
      
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    });

    // Listener for when user taps on notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      if (onNotificationTapped) {
        onNotificationTapped(response);
      }
    });
  }

  /**
   * Send push token to backend
   */
  static async sendTokenToBackend(token) {
    try {
      const authToken = await SecureStore.getItemAsync('authToken');
      
      if (!authToken) {
        console.log('No auth token found, cannot register push token');
        return false;
      }

      const deviceId = Device.modelId || Device.deviceName || 'unknown';
      const platform = Platform.OS;

      const response = await fetch('https://bh-alumni-social-media-app.onrender.com/api/notifications/register-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          token: token,
          deviceId: deviceId,
          platform: platform,
        }),
      });

      if (response.ok) {
        return true;
      } else {
        const errorData = await response.json();
        console.error('Failed to register push token:', errorData);
        return false;
      }
    } catch (error) {
      console.error('Error sending token to backend:', error);
      return false;
    }
  }

  /**
   * Update badge count from notification data
   */
  static updateBadgeFromNotification(notification) {
    try {
      const badgeCount = notification.request.content.badge;
      if (typeof badgeCount === 'number') {
        Notifications.setBadgeCountAsync(badgeCount);
      }
    } catch (error) {
      console.error('Error updating badge from notification:', error);
    }
  }

  /**
   * Get current unread counts from backend
   */
  static async getUnreadCounts() {
    try {
      const authToken = await SecureStore.getItemAsync('authToken');
      
      if (!authToken) {
        return { unreadPostsCount: 0, unreadMessagesCount: 0 };
      }

      const response = await fetch('https://bh-alumni-social-media-app.onrender.com/api/notifications/unread-counts', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          unreadPostsCount: data.unreadPostsCount || 0,
          unreadMessagesCount: data.unreadMessagesCount || 0,
          lastPostViewedAt: data.lastPostViewedAt
        };
      } else {
        console.error('Failed to get unread counts');
        return { unreadPostsCount: 0, unreadMessagesCount: 0 };
      }
    } catch (error) {
      console.error('Error getting unread counts:', error);
      return { unreadPostsCount: 0, unreadMessagesCount: 0 };
    }
  }

  /**
   * Update badge count on app icon
   */
  static async updateBadgeCount() {
    try {
      const counts = await this.getUnreadCounts();
      const totalBadge = counts.unreadPostsCount + counts.unreadMessagesCount;
      
      await Notifications.setBadgeCountAsync(totalBadge);
      
      return totalBadge;
    } catch (error) {
      console.error('Error updating badge count:', error);
      return 0;
    }
  }

  /**
   * Mark posts as read
   */
  static async markPostsAsRead() {
    try {
      const authToken = await SecureStore.getItemAsync('authToken');
      
      if (!authToken) {
        return false;
      }

      const response = await fetch('https://bh-alumni-social-media-app.onrender.com/api/notifications/mark-posts-read', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        // Update badge count after marking as read
        await this.updateBadgeCount();
        return true;
      } else {
        console.error('Failed to mark posts as read');
        return false;
      }
    } catch (error) {
      console.error('Error marking posts as read:', error);
      return false;
    }
  }

  /**
   * Mark conversation as read
   */
  static async markConversationAsRead(conversationId) {
    try {
      const authToken = await SecureStore.getItemAsync('authToken');
      
      if (!authToken) {
        return false;
      }

      const url = `https://bh-alumni-social-media-app.onrender.com/api/notifications/mark-conversation-read/${conversationId}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        // Update badge count after marking as read
        await this.updateBadgeCount();
        return true;
      } else {
        console.error('Failed to mark conversation as read. Status:', response.status);
        return false;
      }
    } catch (error) {
      console.error('Error marking conversation as read:', error);
      return false;
    }
  }

  /**
   * Get notification settings for current user
   */
  static async getNotificationSettings() {
    try {
      const authToken = await SecureStore.getItemAsync('authToken');
      
      if (!authToken) {
        return null;
      }

      const response = await fetch('https://bh-alumni-social-media-app.onrender.com/api/notifications/settings', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        return await response.json();
      } else {
        console.error('Failed to get notification settings');
        return null;
      }
    } catch (error) {
      console.error('Error getting notification settings:', error);
      return null;
    }
  }

  /**
   * Update notification settings
   */
  static async updateNotificationSettings(settings) {
    try {
      const authToken = await SecureStore.getItemAsync('authToken');
      
      if (!authToken) {
        return false;
      }

      const response = await fetch('https://bh-alumni-social-media-app.onrender.com/api/notifications/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        return await response.json();
      } else {
        console.error('Failed to update notification settings');
        return null;
      }
    } catch (error) {
      console.error('Error updating notification settings:', error);
      return null;
    }
  }

  /**
   * Remove push token (call on logout)
   */
  static async removePushToken() {
    try {
      const authToken = await SecureStore.getItemAsync('authToken');
      
      if (!authToken) {
        return true; // Already logged out
      }

      // Get current token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      
      if (!projectId) {
        return true; // Can't get token anyway
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenData.data;

      const response = await fetch('https://bh-alumni-social-media-app.onrender.com/api/notifications/remove-token', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ token }),
      });

      if (response.ok) {
        console.log('Push token removed from backend');
      } else {
        console.error('Failed to remove push token from backend');
      }

      // Clear badge count
      await Notifications.setBadgeCountAsync(0);

      return true;
    } catch (error) {
      console.error('Error removing push token:', error);
      return false;
    }
  }

  /**
   * Handle notification navigation
   */
  static handleNotificationNavigation(notification, router) {
    try {
      const data = notification.request.content.data;
      
      if (!data || !data.type) {
        return;
      }

      switch (data.type) {
        case 'NEW_POST':
          // Navigate to posts feed
          router.push('/post');
          break;
          
        case 'NEW_MESSAGE':
          // Navigate to specific conversation
          if (data.conversationId) {
            router.push(`/seeMessages?conversationId=${data.conversationId}`);
          } else {
            router.push('/messaging');
          }
          break;
          
        case 'NEW_COMMENT':
        case 'NEW_LIKE':
          // Navigate to posts feed (could be enhanced to go to specific post)
          router.push('/post');
          break;
          
        default:
          console.log('Unknown notification type:', data.type);
          break;
      }
    } catch (error) {
      console.error('Error handling notification navigation:', error);
    }
  }

  /**
   * Clean up listeners
   */
  static cleanup() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
      this.notificationListener = null;
    }
    
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
      this.responseListener = null;
    }
  }
}

export default NotificationService;