import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Image, 
  Dimensions, 
  StatusBar, 
  Alert,
  ActivityIndicator 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Video } from 'expo-av';
import * as SecureStore from 'expo-secure-store';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const StoryPreview = () => {
  const { mediaUri, mediaType, source } = useLocalSearchParams();
  const router = useRouter();
  const [isPosting, setIsPosting] = useState(false);

  const handlePostStory = async () => {
    if (!mediaUri) {
      Alert.alert('Error', 'No media selected');
      return;
    }

    setIsPosting(true);

    try {
      // Get auth token
      const authToken = await SecureStore.getItemAsync('authToken');
      if (!authToken) {
        Alert.alert('Error', 'Please log in to post a story');
        router.push('/login');
        return;
      }

      // For now, we'll simulate posting (replace with real API call later)
      await simulatePostStory(mediaUri, mediaType);

      // Show success message
      Alert.alert(
        'Story Posted!',
        'Your story has been shared with the community.',
        [
          {
            text: 'OK',
            onPress: () => router.push('/stories')
          }
        ]
      );

    } catch (error) {
      console.error('Error posting story:', error);
      Alert.alert('Error', 'Failed to post story. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  // Simulate API call - replace with real backend integration later
  const simulatePostStory = async (uri, type) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('Story "posted":', { uri, type, timestamp: new Date() });
        resolve();
      }, 2000); // Simulate network delay
    });
  };

  const handleRetake = () => {
    if (source === 'camera') {
      router.push('/createStory');
    } else {
      router.push('/createStory');
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Discard Story?',
      'Are you sure you want to discard this story?',
      [
        { text: 'Keep Editing', style: 'cancel' },
        { 
          text: 'Discard', 
          style: 'destructive',
          onPress: () => router.push('/stories')
        }
      ]
    );
  };

  if (!mediaUri) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <Text style={styles.errorText}>No media selected</Text>
        <TouchableOpacity style={styles.errorButton} onPress={() => router.push('/createStory')}>
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* Media Preview */}
      <View style={styles.mediaContainer}>
        {mediaType === 'video' ? (
          <Video
            source={{ uri: mediaUri }}
            style={styles.media}
            useNativeControls
            resizeMode="cover"
            shouldPlay={false}
          />
        ) : (
          <Image 
            source={{ uri: mediaUri }} 
            style={styles.media}
            resizeMode="cover"
          />
        )}
      </View>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={handleCancel}>
          <Text style={styles.headerButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Preview</Text>
        <TouchableOpacity style={styles.headerButton} onPress={handleRetake}>
          <Text style={styles.headerButtonText}>Retake</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        <View style={styles.previewInfo}>
          <Text style={styles.previewText}>
            {mediaType === 'video' ? '📹 Video Story' : '📸 Photo Story'}
          </Text>
          <Text style={styles.previewSubtext}>
            This will be visible to your community for 24 hours
          </Text>
        </View>

        <TouchableOpacity 
          style={[styles.postButton, isPosting && styles.postButtonDisabled]}
          onPress={handlePostStory}
          disabled={isPosting}
        >
          {isPosting ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#ffffff" />
              <Text style={styles.postButtonText}>Posting...</Text>
            </View>
          ) : (
            <Text style={styles.postButtonText}>Share Story</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default StoryPreview;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  mediaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    width: screenWidth,
    height: screenHeight,
    position: 'absolute',
  },
  header: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  headerButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '300',
    letterSpacing: 1,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 30,
    paddingBottom: 50,
    paddingTop: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 10,
  },
  previewInfo: {
    alignItems: 'center',
    marginBottom: 30,
  },
  previewText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  previewSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '300',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  postButton: {
    backgroundColor: '#2c3e50',
    paddingVertical: 18,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  postButtonDisabled: {
    backgroundColor: '#7f8c8d',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 0.5,
    marginLeft: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    paddingHorizontal: 40,
  },
  errorText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '300',
    textAlign: 'center',
    marginBottom: 30,
    letterSpacing: 0.5,
  },
  errorButton: {
    backgroundColor: '#2c3e50',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  errorButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
});