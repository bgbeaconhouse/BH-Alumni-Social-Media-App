import { StyleSheet, Text, View, TouchableOpacity, StatusBar, Alert, Linking } from 'react-native';
import { Link, useRouter } from 'expo-router';
import React from 'react';
import * as SecureStore from 'expo-secure-store';

const Support = () => {
  const router = useRouter();

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you absolutely sure you want to delete your account? This action cannot be undone and will permanently remove all your data, posts, messages, and account information.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => confirmDeleteAccount()
        }
      ]
    );
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      "Final Confirmation",
      "This is your last chance to cancel. Your account and all associated data will be permanently deleted. Are you sure?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Yes, Delete Forever",
          style: "destructive",
          onPress: () => deleteAccount()
        }
      ]
    );
  };

  const deleteAccount = async () => {
    try {
      const token = await SecureStore.getItemAsync('authToken');
      
      console.log('Token found:', token ? 'Yes' : 'No'); // Debug log
      
      if (!token) {
        Alert.alert('Error', 'You must be logged in to delete your account.');
        return;
      }

      console.log('Attempting to delete account...'); // Debug log

      const response = await fetch('https://bh-alumni-social-media-app.onrender.com/api/profiles/me', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status); // Debug log

      if (response.ok) {
        // Clear secure storage
        await SecureStore.deleteItemAsync('authToken');
        
        Alert.alert(
          'Account Deleted',
          'Your account has been successfully deleted. We\'re sorry to see you go.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/login') // Navigate to login screen
            }
          ]
        );
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.message || 'Failed to delete account. Please try again.');
      }
    } catch (error) {
      console.error('Delete account error:', error);
      Alert.alert('Error', 'Network error. Please check your connection and try again.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
             
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton}>
          <Link href="/post" style={styles.backButtonText}>
            ← Back
          </Link>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        <View style={styles.brandSection}>
          <Text style={styles.logo}>BH</Text>
          <Text style={styles.title}>Support</Text>
          <Text style={styles.subtitle}>We're here to help</Text>
        </View>

        <View style={styles.supportSection}>
          <Text style={styles.supportText}>
            For any questions, concerns, or technical issues with the app, please reach out to us:
          </Text>
                     
          <Text style={styles.emailText}>bgbeaconhouse@gmail.com</Text>
        </View>

        {/* Delete Account Section */}
        <View style={styles.deleteSection}>
          <Text style={styles.deleteTitle}>Account Management</Text>
          <Text style={styles.deleteWarning}>
            If you need to delete your account, please note this action is permanent and cannot be undone.
          </Text>
          
          <TouchableOpacity 
            style={styles.deleteButton} 
            onPress={handleDeleteAccount}
          >
           <Text style={styles.deleteButtonText}>Delete My Account</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.privacyButton} 
            onPress={() => Linking.openURL('https://sites.google.com/view/beacon-house-alumni/home')}
          >
            <Text style={styles.privacyText}>Privacy Policy</Text>
          </TouchableOpacity>

        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Beacon House • Connected in recovery</Text>
      </View>
    </View>
  );
};

export default Support;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 30,
    paddingBottom: 20,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: '#7f8c8d',
    fontSize: 16,
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
    marginBottom: 60,
  },
  logo: {
    fontSize: 48,
    fontWeight: '100',
    color: '#2c3e50',
    letterSpacing: 8,
    marginBottom: 16,
  },
  title: {
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
  supportSection: {
    alignItems: 'center',
    maxWidth: 320,
    alignSelf: 'center',
    marginBottom: 50,
  },
  supportText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  emailText: {
    fontSize: 18,
    color: '#2c3e50',
    fontWeight: '300',
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
    paddingBottom: 8,
  },

  deleteSection: {
    alignItems: 'center',
    maxWidth: 320,
    alignSelf: 'center',
    paddingTop: 30,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
  },
  deleteTitle: {
    fontSize: 18,
    color: '#2c3e50',
    fontWeight: '300',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  deleteWarning: {
    fontSize: 14,
    color: '#e74c3c',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#c0392b',
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '400',
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