// frontend/app/index.jsx
import { StyleSheet, Text, TouchableOpacity, View, StatusBar, ActivityIndicator, Image } from 'react-native';
import React, { useEffect, useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '../hooks/useAuth';

const Home = () => {
  const { isAuthenticated, isLoading, checkAuthStatus } = useAuth();
  const router = useRouter();
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);

  useEffect(() => {
    const performInitialCheck = async () => {
      await checkAuthStatus();
      setInitialCheckComplete(true);
    };
    performInitialCheck();
  }, [checkAuthStatus]);

useEffect(() => {
  if (initialCheckComplete && isAuthenticated) {
    setTimeout(() => {
   router.replace('/(tabs)/post');
    }, 100);
  }
}, [isAuthenticated, initialCheckComplete, router]);

  // Loading screen
  if (isLoading || !initialCheckComplete) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <Image
          source={require('../assets/BH-App-Icon.png')}
          style={styles.loadingLogo}
          resizeMode="contain"
        />
        <ActivityIndicator size="small" color="#2c3e50" style={styles.spinner} />
      </View>
    );
  }

  // Welcome screen
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Center — Logo */}
      <View style={styles.content}>
        <Image
          source={require('../assets/BH-App-Icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Bottom — Buttons */}
      <View style={styles.bottomSection}>
        <Link href="/login" asChild>
          <TouchableOpacity style={styles.loginButton}>
            <Text style={styles.loginText}>Sign In</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/register" asChild>
          <TouchableOpacity style={styles.registerButton}>
            <Text style={styles.registerText}>Create new account</Text>
          </TouchableOpacity>
        </Link>

        
      </View>
    </View>
  );
};

export default Home;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'space-between',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLogo: {
    width: 80,
    height: 80,
    marginBottom: 20,
  },
  spinner: {
    marginTop: 10,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 200,
  },
  bottomSection: {
    paddingHorizontal: 40,
    paddingBottom: 50,
    alignItems: 'center',
  },
  loginButton: {
    backgroundColor: '#3797EF',
    paddingVertical: 14,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  loginText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  registerButton: {
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbdbdb',
    width: '100%',
    alignItems: 'center',
    marginBottom: 30,
  },
  registerText: {
    color: '#3797EF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

});