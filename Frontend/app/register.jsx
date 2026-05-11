import { StyleSheet, Text, View, TouchableOpacity, TextInput, Alert, ScrollView, KeyboardAvoidingView, Platform, StatusBar, Image } from 'react-native';
import { Link, router } from 'expo-router';
import React, { useState } from 'react';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    yearGraduated: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = async () => {
    // Basic validation
    const requiredFields = ['username', 'password', 'email', 'firstName', 'lastName', 'phoneNumber', 'yearGraduated'];
    const emptyFields = requiredFields.filter(field => !formData[field].trim());
    
    if (emptyFields.length > 0) {
      Alert.alert('Validation Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const dataToSend = {
        ...formData,
        yearGraduated: parseInt(formData.yearGraduated, 10),
      };

      const response = await fetch('https://bh-alumni-social-media-app.onrender.com/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }

      const result = await response.json();
      Alert.alert('Registration Successful', result.message, [
        {
          text: 'OK',
          onPress: () => {
            router.push('/');
          },
        },
      ]);
      setFormData({
        username: '',
        password: '',
        email: '',
        firstName: '',
        lastName: '',
        phoneNumber: '',
        yearGraduated: '',
      });

    } catch (error) {
      Alert.alert('Registration Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

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
          <View style={styles.inputRow}>
            <View style={styles.halfInput}>
              <TextInput
                style={styles.input}
                placeholder="First Name"
                placeholderTextColor="#aaaaaa"
                value={formData.firstName}
                onChangeText={(text) => handleChange('firstName', text)}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.halfInput}>
              <TextInput
                style={styles.input}
                placeholder="Last Name"
                placeholderTextColor="#aaaaaa"
                value={formData.lastName}
                onChangeText={(text) => handleChange('lastName', text)}
                autoCapitalize="words"
              />
            </View>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#aaaaaa"
            value={formData.username}
            onChangeText={(text) => handleChange('username', text)}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#aaaaaa"
            value={formData.email}
            onChangeText={(text) => handleChange('email', text)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Sobriety Date"
            placeholderTextColor="#aaaaaa"
            value={formData.phoneNumber}
            onChangeText={(text) => handleChange('phoneNumber', text)}
          />

          <TextInput
            style={styles.input}
            placeholder="Year Graduated"
            placeholderTextColor="#aaaaaa"
            value={formData.yearGraduated}
            onChangeText={(text) => handleChange('yearGraduated', text)}
            keyboardType="numeric"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#aaaaaa"
            secureTextEntry
            value={formData.password}
            onChangeText={(text) => handleChange('password', text)}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[styles.registerButton, loading && styles.registerButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.registerButtonText}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </Text>
          </TouchableOpacity>

          <View style={styles.loginPrompt}>
            <Text style={styles.promptText}>Already have an account? </Text>
            <Link href="/login" style={styles.loginLink}>
              Sign In
            </Link>
          </View>
        </View>

        {/* Back */}
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

export default Register;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'space-between',
  },
  logoSection: {
    alignItems: 'center',
    paddingTop: 60,
    marginBottom: 30,
  },
  logo: {
    width: 140,
    height: 140,
  },
  formSection: {
    paddingHorizontal: 40,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  halfInput: {
    width: '48%',
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
    marginBottom: 12,
  },
  registerButton: {
    backgroundColor: '#3797EF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  registerButtonDisabled: {
    backgroundColor: '#a8d4f7',
  },
  registerButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  loginPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  promptText: {
    color: '#7f8c8d',
    fontSize: 14,
    fontWeight: '300',
  },
  loginLink: {
    color: '#3797EF',
    fontSize: 14,
    fontWeight: '500',
  },
  bottomSection: {
    paddingBottom: 40,
    alignItems: 'center',
    marginTop: 20,
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