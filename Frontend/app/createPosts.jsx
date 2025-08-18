import { StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, StatusBar } from 'react-native';
import { useState, useEffect } from 'react';
import { Link, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';

const CreatePosts = () => {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [authToken, setAuthToken] = useState(null);
  const [media, setMedia] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  useEffect(() => {
    const getToken = async () => {
      try {
        const token = await SecureStore.getItemAsync('authToken');
        if (token) {
          setAuthToken(token);
        } else {
          console.log('No auth token found. Redirecting to login.');
          router.replace('/login');
        }
      } catch (error) {
        console.error('Error fetching auth token:', error);
        router.replace('/login');
      }
    };

    getToken();
  }, [router]);

  const pickMedia = async () => {
    setIsUploadingMedia(true);
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets) {
        setMedia(prevMedia => [...prevMedia, ...result.assets]);
        console.log('Selected media:', result.assets);
      }
    } catch (error) {
      console.error('Error picking media:', error);
      showAlert('Error selecting media. Please try again.');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const showAlert = (message) => {
    console.warn("App Alert:", message);
  };

  const handleSubmit = async () => {
    if (!content.trim() && media.length === 0) {
      showAlert('Post content or media must be provided.');
      return;
    }

    if (!authToken) {
      showAlert('Authentication token not available. Please log in.');
      router.replace('/login');
      return;
    }

    setIsSubmitting(true);

    try {
      const apiUrl = 'https://bh-alumni-social-media-app.onrender.com/api/posts';
      const formData = new FormData();

      formData.append('content', content);

      media.forEach((item) => {
        const uriParts = item.uri.split('.');
        const fileType = uriParts[uriParts.length - 1];
        formData.append('media', {
          uri: item.uri,
          name: `media-${Date.now()}.${fileType}`,
          type: item.type === 'image' ? `image/${fileType}` : `video/${fileType}`,
        });
      });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: formData,
      });

      const responseData = await response.json();

      if (response.ok) {
        console.log('Post created successfully:', responseData);
        setContent('');
        setMedia([]);
        router.push('/post');
      } else {
        console.error('Failed to create post:', responseData);
        showAlert(`Failed to create post: ${responseData.error || 'Something went wrong'}`);
      }
    } catch (error) {
      console.error('Error submitting post:', error);
      showAlert('Error submitting post.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.push('/post')}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Brand Section */}
        <View style={styles.brandSection}>
          <Text style={styles.logo}>BH</Text>
          <Text style={styles.title}>New Post</Text>
          <Text style={styles.subtitle}>Share with your community</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="What's on your mind?"
              placeholderTextColor="#bdc3c7"
              multiline
              numberOfLines={6}
              value={content}
              onChangeText={setContent}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity 
            style={[styles.mediaButton, isUploadingMedia && styles.disabledButton]} 
            onPress={pickMedia} 
            disabled={isUploadingMedia}
          >
            {isUploadingMedia ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#7f8c8d" />
                <Text style={styles.loadingText}>Selecting...</Text>
              </View>
            ) : (
              <Text style={styles.mediaButtonText}>Add Photos/Videos</Text>
            )}
          </TouchableOpacity>

          {media.length > 0 && (
            <View style={styles.mediaPreview}>
              <Text style={styles.mediaCount}>{media.length} file{media.length !== 1 ? 's' : ''} selected</Text>
              {media.slice(0, 3).map((item, index) => (
                <Text key={index} style={styles.mediaItemText}>
                  {item.uri.substring(item.uri.lastIndexOf('/') + 1)}
                </Text>
              ))}
              {media.length > 3 && (
                <Text style={styles.moreMediaText}>and {media.length - 3} more...</Text>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitButton, (isSubmitting || (!content.trim() && media.length === 0)) && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={isSubmitting || (!content.trim() && media.length === 0)}
          >
            {isSubmitting ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.submitButtonText}>Publishing...</Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>Publish Post</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Beacon House • Connected in recovery</Text>
      </View>
    </View>
  );
};

export default CreatePosts;

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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 30,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 50,
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
  formSection: {
    flex: 1,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  inputContainer: {
    marginBottom: 30,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
    paddingVertical: 20,
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '300',
    letterSpacing: 0.5,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  mediaButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ecf0f1',
  },
  disabledButton: {
    opacity: 0.6,
  },
  mediaButtonText: {
    color: '#7f8c8d',
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    marginLeft: 8,
    color: '#7f8c8d',
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  mediaPreview: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#ecf0f1',
  },
  mediaCount: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '300',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  mediaItemText: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '300',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  moreMediaText: {
    fontSize: 12,
    color: '#bdc3c7',
    fontWeight: '300',
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },
  submitButton: {
    backgroundColor: '#2c3e50',
    paddingVertical: 18,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  footer: {
    paddingBottom: 30,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#bdc3c7',
    fontWeight: '300',
    letterSpacing: 1,
  },
});