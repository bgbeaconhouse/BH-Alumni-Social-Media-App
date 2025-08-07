// frontend/app/index.js
import { StyleSheet, Text, TouchableOpacity, View, StatusBar, ActivityIndicator } from 'react-native';
import React, { useEffect, useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '../hooks/useAuth';

const Home = () => {
  const { isAuthenticated, isLoading, checkAuthStatus } = useAuth();
  const router = useRouter();
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);

  useEffect(() => {
    const performInitialCheck = async () => {
      console.log('🚀 App starting - checking auth status...');
      
      // Wait for auth check to complete
      await checkAuthStatus();
      setInitialCheckComplete(true);
    };

    performInitialCheck();
  }, [checkAuthStatus]);

  // Redirect to home if authenticated
  useEffect(() => {
    if (initialCheckComplete && isAuthenticated) {
      console.log('✅ User authenticated, redirecting to home...');
      router.replace('/home');
    }
  }, [isAuthenticated, initialCheckComplete, router]);

  // Show loading screen while checking authentication
  if (isLoading || !initialCheckComplete) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        
        <View style={styles.loadingContent}>
          <Text style={styles.logo}>BH</Text>
          <ActivityIndicator size="large" color="#2c3e50" style={styles.spinner} />
          <Text style={styles.loadingText}>Checking authentication...</Text>
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>Beacon House • Est. 1974</Text>
        </View>
      </View>
    );
  }

  // Show welcome screen if not authenticated
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
             
      {/* Main Content - Centered */}
      <View style={styles.content}>
        <View style={styles.brandSection}>
          <Text style={styles.logo}>BH</Text>
          <Text style={styles.title}>Alumni Connect</Text>
          <Text style={styles.tagline}>Connected for life</Text>
        </View>

        <View style={styles.actionButtons}>
          <Link href="/login" asChild>
            <TouchableOpacity style={styles.loginButton}>
              <Text style={styles.loginText}>Sign In</Text>
            </TouchableOpacity>
          </Link>
                     
          <Link href="/register" asChild>
            <TouchableOpacity style={styles.registerButton}>
              <Text style={styles.registerText}>Join Network</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
             
      {/* Simple Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Beacon House • Est. 1974</Text>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'space-between',
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 28,
    fontWeight: '300',
    color: '#2c3e50',
    marginBottom: 8,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  spinner: {
    marginVertical: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '300',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  actionButtons: {
    width: '100%',
    maxWidth: 280,
  },
  loginButton: {
    backgroundColor: '#2c3e50',
    paddingVertical: 18,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  loginText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  registerButton: {
    backgroundColor: 'transparent',
    paddingVertical: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2c3e50',
    alignItems: 'center',
  },
  registerText: {
    color: '#2c3e50',
    fontSize: 16,
    fontWeight: '500',
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