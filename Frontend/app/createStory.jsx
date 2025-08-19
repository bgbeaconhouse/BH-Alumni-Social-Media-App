import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, StatusBar, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

const CreateStory = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const requestPermissions = async () => {
    try {
      // Request camera permissions
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      // Request media library permissions
      const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (cameraPermission.status !== 'granted' || mediaPermission.status !== 'granted') {
        Alert.alert(
          'Permissions Required',
          'Camera and photo library access are needed to create stories.',
          [{ text: 'OK' }]
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  };

  const handleTakePhoto = async () => {
    const hasPermissions = await requestPermissions();
    if (!hasPermissions) return;

    setIsLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.8,
        videoMaxDuration: 10, // 10 second max for stories
        aspect: [9, 16], // Story aspect ratio
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const selectedMedia = result.assets[0];
        const mediaType = selectedMedia.type === 'video' ? 'video' : 'image';
        // Navigate to preview with the captured media
        router.push({
          pathname: '/storyPreview',
          params: {
            mediaUri: selectedMedia.uri,
            mediaType: mediaType,
            source: 'camera'
          }
        });
      }
    } catch (error) {
      console.error('Error taking media:', error);
      Alert.alert('Error', 'Failed to capture media. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChooseFromGallery = async () => {
    const hasPermissions = await requestPermissions();
    if (!hasPermissions) return;

    setIsLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.8,
        aspect: [9, 16],
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const selectedMedia = result.assets[0];
        const mediaType = selectedMedia.type === 'video' ? 'video' : 'image';
        
        // Navigate to preview with the selected media
        router.push({
          pathname: '/storyPreview',
          params: {
            mediaUri: selectedMedia.uri,
            mediaType: mediaType,
            source: 'gallery'
          }
        });
      }
    } catch (error) {
      console.error('Error choosing from gallery:', error);
      Alert.alert('Error', 'Failed to select media. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('/stories')}>
          <Text style={styles.backButtonText}>← Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Story</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Creation Options */}
        <View style={styles.optionsSection}>
          <TouchableOpacity 
            style={[styles.optionButton, styles.primaryOption]}
            onPress={handleTakePhoto}
            disabled={isLoading}
          >
            <View style={styles.optionContent}>
              <Text style={styles.optionIcon}>📹</Text>
              <Text style={styles.primaryOptionText}>Capture</Text>
              <Text style={styles.optionDescription}>Take photo or record video</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.optionButton}
            onPress={handleChooseFromGallery}
            disabled={isLoading}
          >
            <View style={styles.optionContent}>
              <Text style={styles.optionIcon}>🖼️</Text>
              <Text style={styles.optionText}>Choose from Gallery</Text>
              <Text style={styles.optionDescription}>Select photo or video</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Guidelines */}
        <View style={styles.guidelinesSection}>
          <Text style={styles.guidelinesTitle}>Story Guidelines</Text>
          <Text style={styles.guidelineText}>• Stories are visible for 24 hours</Text>
          <Text style={styles.guidelineText}>• Share positive recovery moments</Text>
          <Text style={styles.guidelineText}>• Respect community guidelines</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Beacon House • Connected in recovery</Text>
      </View>
    </View>
  );
};

export default CreateStory;

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
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  backButton: {
    minWidth: 60,
    alignItems: 'flex-start',
  },
  backButtonText: {
    color: '#7f8c8d',
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '100',
    color: '#2c3e50',
    letterSpacing: 2,
  },
  headerSpacer: {
    minWidth: 60,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  optionsSection: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
    marginBottom: 40,
  },
  optionButton: {
    backgroundColor: 'transparent',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ecf0f1',
    alignItems: 'center',
  },
  primaryOption: {
    backgroundColor: '#2c3e50',
    borderColor: '#2c3e50',
  },
  optionContent: {
    alignItems: 'center',
  },
  optionIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  primaryOptionText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '300',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  optionText: {
    color: '#2c3e50',
    fontSize: 18,
    fontWeight: '300',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  optionDescription: {
    color: '#7f8c8d',
    fontSize: 14,
    fontWeight: '300',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  guidelinesSection: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ecf0f1',
  },
  guidelinesTitle: {
    fontSize: 16,
    fontWeight: '300',
    color: '#2c3e50',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 1,
  },
  guidelineText: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '300',
    marginBottom: 4,
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