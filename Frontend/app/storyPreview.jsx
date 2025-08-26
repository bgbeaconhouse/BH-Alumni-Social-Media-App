import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Image, 
  Dimensions, 
  StatusBar, 
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Video } from 'expo-av';
import * as SecureStore from 'expo-secure-store';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const StoryPreview = () => {
  const { mediaUri, mediaType, source } = useLocalSearchParams();
  const router = useRouter();
  const [isPosting, setIsPosting] = useState(false);

  // Debug logging to see what we received
  useEffect(() => {
    console.log('🔍 Media URI received:', mediaUri);
    console.log('🔍 Media type:', mediaType);
    console.log('🔍 Source:', source);
  }, [mediaUri, mediaType, source]);

  // Android file access handler - try different approaches
  const getAndroidCompatibleUri = (uri) => {
    if (Platform.OS === 'android' && uri) {
      console.log('🔍 Original URI:', uri);
      
      // For Android, try using the original URI without modifications
      // Expo Go has different file access than production builds
      return uri;
    }
    return uri;
  };

  const handlePostStory = async () => {
    if (!mediaUri) {
      Alert.alert('Error', 'No media selected');
      return;
    }

    setIsPosting(true);

    try {
      const authToken = await SecureStore.getItemAsync('authToken');
      
      if (!authToken) {
        Alert.alert('Error', 'Please log in to post a story');
        router.push('/login');
        return;
      }

      console.log('📤 About to post story...');
      console.log('🔍 Media URI:', mediaUri);
      console.log('🔍 Media Type:', mediaType);

      const formData = new FormData();
      
      // Get file extension from URI
      const uriParts = mediaUri.split('.');
      const fileExtension = uriParts[uriParts.length - 1].toLowerCase();
      
      // Determine proper MIME type
      let mimeType;
      if (fileExtension === 'jpg' || fileExtension === 'jpeg') {
        mimeType = 'image/jpeg';
      } else if (fileExtension === 'png') {
        mimeType = 'image/png';
      } else if (fileExtension === 'gif') {
        mimeType = 'image/gif';
      } else if (fileExtension === 'mp4') {
        mimeType = 'video/mp4';
      } else if (fileExtension === 'mov') {
        mimeType = 'video/quicktime';
      } else {
        // Fallback based on mediaType prop
        mimeType = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
      }
      
      // CRITICAL FIX: Use 'media' as the field name (not 'file')
      // The backend expects req.files (array) not req.file (single)
      formData.append('media', {
        uri: mediaUri,
        type: mimeType,
        name: `story-${Date.now()}.${fileExtension}`,
      });

      console.log('📤 Uploading with FormData field "media"');
      console.log('🔍 File details:', {
        name: `story-${Date.now()}.${fileExtension}`,
        type: mimeType,
        extension: fileExtension
      });

      const response = await fetch('https://bh-alumni-social-media-app.onrender.com/api/stories', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          // Don't set Content-Type - let FormData handle it
        },
        body: formData,
      });

      console.log('🔍 Response status:', response.status);
      
      const responseText = await response.text();
      console.log('🔍 Response text:', responseText);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseText}`);
      }

      const result = JSON.parse(responseText);
      console.log('✅ Story posted successfully:', result);

      Alert.alert(
        'Story Posted!',
        'Your story has been shared with the community.',
        [{ text: 'OK', onPress: () => router.push('/stories') }]
      );

    } catch (error) {
      console.error('❌ Error posting story:', error);
      Alert.alert('Debug Error Details', `
        Error: ${error.message}
        
        Media URI: ${mediaUri}
        Media Type: ${mediaType}
        Platform: ${Platform.OS}
      `);
    } finally {
      setIsPosting(false);
    }
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
            source={{ uri: getAndroidCompatibleUri(mediaUri) }}
            style={styles.media}
            useNativeControls
            resizeMode="cover"
            shouldPlay={false}
            onError={(error) => {
              console.log('❌ Video load error:', error);
              console.log('❌ Failed URI:', mediaUri);
            }}
            onLoad={() => {
              console.log('✅ Video loaded successfully');
            }}
          />
        ) : (
          <Image 
            source={{ uri: getAndroidCompatibleUri(mediaUri) }} 
            style={styles.media}
            resizeMode="cover"
            onLoad={(event) => {
              console.log('✅ Image loaded successfully');
              console.log('✅ Image dimensions:', event.nativeEvent.source);
            }}
            onError={(error) => {
              console.log('❌ Image load error:', error.nativeEvent);
              console.log('❌ Failed URI:', mediaUri);
              console.log('❌ Platform:', Platform.OS);
            }}
            onLoadStart={() => {
              console.log('🔄 Image load started for:', mediaUri);
            }}
            onLoadEnd={() => {
              console.log('⏹️ Image load ended');
            }}
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