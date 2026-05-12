import { StyleSheet, Text, View, TouchableOpacity, TextInput, Alert, ScrollView, KeyboardAvoidingView, Platform, StatusBar, Keyboard, Image } from 'react-native';
import { Link, useRouter } from 'expo-router';
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [autoFillLoaded, setAutoFillLoaded] = useState(false);
  
  const router = useRouter();
  const passwordInputRef = useRef(null);
  
  const { login, getSavedCredentials } = useAuth();

  // Load saved credentials on component mount
  useEffect(() => {
    const loadSavedCredentials = async () => {
      try {
        const savedCreds = await getSavedCredentials();
        
        if (savedCreds.username || savedCreds.password) {
          setFormData({
            username: savedCreds.username,
            password: savedCreds.password,
          });
          setRememberMe(savedCreds.rememberMe);
          console.log('💾 Loaded saved credentials');
        }
        
        setAutoFillLoaded(true);
      } catch (error) {
        console.error('Error loading saved credentials:', error);
        setAutoFillLoaded(true);
      }
    };

    loadSavedCredentials();
  }, [getSavedCredentials]);

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = async () => {
    // Dismiss keyboard first to prevent UI issues
    Keyboard.dismiss();
    
    // Add small delay to ensure keyboard is dismissed
    setTimeout(async () => {
      // Basic validation
      if (!formData.username.trim() || !formData.password.trim()) {
        Alert.alert('Validation Error', 'Please fill in all fields');
        return;
      }

      setLoading(true);
      
      try {
        const result = await login(formData.username, formData.password, rememberMe);
        
        if (result.success) {
          Alert.alert('Login Successful', result.message || 'Welcome back!', [
            {
              text: 'OK',
              onPress: () => {
                router.replace('/(tabs)/post');
              },
            },
          ]);
          
          // Clear form
          setFormData({ username: '', password: '' });
        } else {
          Alert.alert('Login Failed', result.message);
        }
        
      } catch (error) {
        Alert.alert('Login Failed', 'An unexpected error occurred. Please try again.');
        console.error('Login error:', error);
      } finally {
        setLoading(false);
      }
    }, 100); // Small delay to ensure keyboard dismissal
  };

  // Show loading state while auto-fill is being loaded
  if (!autoFillLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

 return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
<View style={styles.logoSection}>
  <Image
    source={require('../assets/BH-App-Icon.png')}
    style={styles.logo}
    resizeMode="contain"
  />
</View>

        {/* Form */}
        <View style={styles.formSection}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#aaaaaa"
              value={formData.username}
              onChangeText={(text) => handleChange('username', text)}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => passwordInputRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.passwordContainer}>
              <TextInput
                ref={passwordInputRef}
                style={styles.passwordInput}
                placeholder="Password"
                placeholderTextColor="#aaaaaa"
                secureTextEntry={!showPassword}
                value={formData.password}
                onChangeText={(text) => handleChange('password', text)}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
              >
                <Text style={styles.eyeText}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Remember Me */}
          <View style={styles.rememberMeContainer}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>Remember me</Text>
            </TouchableOpacity>
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.loginButtonText}>
              {loading ? 'Signing In...' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          {/* Forgot Password */}
  <TouchableOpacity
  style={styles.forgotPasswordButton}
  onPress={() => router.push('/forgotPassword')}
  activeOpacity={0.7}
>
  <Text style={styles.forgotPasswordText}>Forgot password?</Text>
</TouchableOpacity>
        </View>

        {/* Bottom — Back to landing */}
        <View style={styles.bottomSection}>
          <Link href="/" asChild>
            <TouchableOpacity style={styles.backButton}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default Login;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'space-between',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '300',
  },
  logoSection: {
    alignItems: 'center',
    paddingTop: 80,
    marginBottom: 40,
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 16,
  },
  heading: {
    fontSize: 32,
    fontWeight: '300',
    color: '#1a3a5c',
    letterSpacing: 2,
    textAlign: 'center',
  },
  subheading: {
    fontSize: 14,
    fontWeight: '300',
    color: '#1a3a5c',
    letterSpacing: 3,
    marginTop: 4,
    textAlign: 'center',
  },
  formSection: {
    paddingHorizontal: 40,
  },
  inputContainer: {
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#dbdbdb',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#2c3e50',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#dbdbdb',
    borderRadius: 8,
    paddingHorizontal: 16,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: '#2c3e50',
  },
  eyeButton: {
    paddingLeft: 10,
  },
  eyeText: {
    fontSize: 16,
  },
  rememberMeContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#3797EF',
    borderColor: '#3797EF',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '300',
  },
  loginButton: {
    backgroundColor: '#3797EF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  loginButtonDisabled: {
    backgroundColor: '#a8d4f7',
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  forgotPasswordButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  forgotPasswordText: {
    color: '#3797EF',
    fontSize: 14,
    fontWeight: '400',
  },
  bottomSection: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  backButton: {
    paddingVertical: 10,
  },
  backText: {
    color: '#7f8c8d',
    fontSize: 14,
    fontWeight: '300',
  },
});