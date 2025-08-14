// frontend/app/home.jsx
import { StyleSheet, Text, View, TouchableOpacity, Alert, StatusBar, Platform } from 'react-native';
import React, { useEffect } from 'react';
import { Link, useRouter } from 'expo-router';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../hooks/useAuth';
import NotificationService from '../services/notificationService';
import * as Notifications from 'expo-notifications';

// DEBUG COMPONENT - Remove this in production
const NotificationDebugger = () => {
  
  const testLocalNotification = async () => {
    try {
      console.log('🧪 Testing local notification...');
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Test Local Notification",
          body: "This is a local test notification",
          data: { type: 'TEST' },
          badge: 1,
          sound: 'default',
        },
        trigger: { seconds: 1 },
      });
      
      Alert.alert('Success', 'Local notification scheduled for 1 second from now');
    } catch (error) {
      console.error('❌ Error scheduling local notification:', error);
      Alert.alert('Error', 'Failed to schedule local notification');
    }
  };

  const debugPermissions = async () => {
    try {
      const debugInfo = await NotificationService.debugNotificationPermissions();
      console.log('🔍 Debug info:', debugInfo);
      
      Alert.alert(
        'Debug Info', 
        `Permissions: ${debugInfo?.permissions?.status}\n` +
        `Device: ${debugInfo?.deviceSupport}\n` +
        `Badge Count: ${debugInfo?.badgeCount}\n` +
        `Check console for full details`
      );
    } catch (error) {
      console.error('❌ Error debugging permissions:', error);
      Alert.alert('Error', 'Failed to debug permissions');
    }
  };

  const testPushToken = async () => {
    try {
      console.log('🎫 Testing push token registration...');
      const token = await NotificationService.registerForPushNotifications();
      
      if (token) {
        const success = await NotificationService.sendTokenToBackend(token);
        Alert.alert(
          'Token Test', 
          `Token: ${token.substring(0, 30)}...\n` +
          `Backend Registration: ${success ? 'Success' : 'Failed'}`
        );
      } else {
        Alert.alert('Token Test', 'Failed to get push token');
      }
    } catch (error) {
      console.error('❌ Error testing push token:', error);
      Alert.alert('Error', 'Failed to test push token');
    }
  };

  const clearBadge = async () => {
    try {
      await Notifications.setBadgeCountAsync(0);
      Alert.alert('Success', 'Badge cleared');
    } catch (error) {
      console.error('❌ Error clearing badge:', error);
      Alert.alert('Error', 'Failed to clear badge');
    }
  };

  return (
    <View style={debugStyles.container}>
      <Text style={debugStyles.title}>🔧 Notification Debugger</Text>
      
      <TouchableOpacity style={debugStyles.button} onPress={testLocalNotification}>
        <Text style={debugStyles.buttonText}>Test Local Notification</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={debugStyles.button} onPress={debugPermissions}>
        <Text style={debugStyles.buttonText}>Debug Permissions</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={debugStyles.button} onPress={testPushToken}>
        <Text style={debugStyles.buttonText}>Test Push Token</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={debugStyles.button} onPress={clearBadge}>
        <Text style={debugStyles.buttonText}>Clear Badge</Text>
      </TouchableOpacity>
    </View>
  );
};

const Home = () => {
  const router = useRouter();
  
  // Auth functionality
  const { user, logout } = useAuth();
  
  // Notification functionality
  const { 
    totalBadgeCount, 
    unreadCounts,
    isInitialized, 
    initializeNotifications,
    handleLogout: cleanupNotifications 
  } = useNotifications();

  // Initialize notifications when home screen loads (after login)
  useEffect(() => {
    if (!isInitialized) {
      initializeNotifications();
    }
  }, [isInitialized, initializeNotifications]);

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "How would you like to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Keep Login Info",
          onPress: async () => {
            try {
              // Clean up notifications first
              await cleanupNotifications();
              
              // Logout but keep saved credentials
              await logout(false);
              
            } catch (error) {
              console.error('Error during logout:', error);
              // Even if there's an error, still navigate away for security
              router.replace('/');
            }
          }
        },
        {
          text: "Forget Login Info",
          style: "destructive",
          onPress: async () => {
            try {
              // Clean up notifications first
              await cleanupNotifications();
              
              // Logout and clear saved credentials
              await logout(true);
              
            } catch (error) {
              console.error('Error during logout:', error);
              // Even if there's an error, still navigate away for security
              router.replace('/');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Text style={styles.welcomeUser}>
            Welcome, {user?.firstName || user?.username || 'User'}
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* DEBUG SECTION - Remove this in production */}
      <NotificationDebugger />

      {/* Main Content */}
      <View style={styles.content}>
        {/* Brand Section */}
        <View style={styles.brandSection}>
          <Text style={styles.logo}>BH</Text>
          <Text style={styles.welcomeText}>Welcome Back</Text>
          <Text style={styles.subtitle}>Your recovery community</Text>
          
          {/* Badge Count Display */}
          {totalBadgeCount > 0 && (
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>
                {totalBadgeCount} unread notification{totalBadgeCount !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Menu Options */}
        <View style={styles.menuSection}>
          <TouchableOpacity style={[styles.menuButton, styles.primaryButton]}>
            <Link href="/post" style={styles.primaryMenuLink}>
              <View style={styles.menuItemContainer}>
                <Text style={styles.primaryMenuText}>Posts</Text>
                {unreadCounts.unreadPostsCount > 0 && (
                  <View style={styles.menuBadge}>
                    <Text style={styles.menuBadgeText}>
                      {unreadCounts.unreadPostsCount > 99 ? '99+' : unreadCounts.unreadPostsCount}
                    </Text>
                  </View>
                )}
              </View>
            </Link>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuButton}>
            <Link href="/messaging" style={styles.menuLink}>
              <View style={styles.menuItemContainer}>
                <Text style={styles.menuText}>Messages</Text>
                {unreadCounts.unreadMessagesCount > 0 && (
                  <View style={[styles.menuBadge, styles.secondaryMenuBadge]}>
                    <Text style={styles.secondaryMenuBadgeText}>
                      {unreadCounts.unreadMessagesCount > 99 ? '99+' : unreadCounts.unreadMessagesCount}
                    </Text>
                  </View>
                )}
              </View>
            </Link>
          </TouchableOpacity>
        </View>

        {/* Auto-Login Status Indicator */}
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            🔒 Auto-login enabled
          </Text>
          <Text style={styles.statusSubtext}>
            You'll stay signed in on this device
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Beacon House • Connected in recovery</Text>
      </View>
    </View>
  );
};

export default Home;

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
    paddingHorizontal: 30,
    paddingBottom: 20,
  },
  userInfo: {
    flex: 1,
  },
  welcomeUser: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  logoutText: {
    color: '#7f8c8d',
    fontSize: 14,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 80,
  },
  logo: {
    fontSize: 48,
    fontWeight: '100',
    color: '#2c3e50',
    letterSpacing: 8,
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '300',
    color: '#2c3e50',
    marginBottom: 8,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  badgeContainer: {
    marginTop: 16,
    backgroundColor: '#e74c3c',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  menuSection: {
    width: '100%',
    maxWidth: 280,
    alignSelf: 'center',
  },
  menuButton: {
    backgroundColor: 'transparent',
    paddingVertical: 20,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ecf0f1',
  },
  primaryButton: {
    backgroundColor: '#2c3e50',
    borderColor: '#2c3e50',
  },
  menuLink: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryMenuLink: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
  },
  menuText: {
    color: '#2c3e50',
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  primaryMenuText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  menuBadge: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  menuBadgeText: {
    color: '#e74c3c',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  secondaryMenuBadge: {
    backgroundColor: '#e74c3c',
  },
  secondaryMenuBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusContainer: {
    marginTop: 40,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ecf0f1',
  },
  statusText: {
    fontSize: 14,
    color: '#27ae60',
    fontWeight: '300',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statusSubtext: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '300',
    letterSpacing: 0.5,
    textAlign: 'center',
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

// Debug styles for the notification debugger
const debugStyles = StyleSheet.create({
  container: {
    padding: 15,
    backgroundColor: '#fff3cd',
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#856404',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
});