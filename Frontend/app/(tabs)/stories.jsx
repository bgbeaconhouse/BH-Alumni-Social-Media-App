import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Image, ActivityIndicator, StatusBar, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

const Stories = () => {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await SecureStore.getItemAsync('authToken');
      if (!token) {
        setError("Please log in to view stories");
        setLoading(false);
        return;
      }

      console.log('📖 Fetching stories from API...');
      const response = await fetch('https://bh-alumni-social-media-app.onrender.com/api/stories', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch stories');
      }

      const storiesData = await response.json();
      console.log(`📖 Fetched ${storiesData.length} stories`);
      setStories(storiesData);

    } catch (err) {
      console.error('Error fetching stories:', err);
      setError(err.message || 'Failed to load stories');
    } finally {
      setLoading(false);
    }
  };

  const handleStoryPress = (story, index) => {
    router.push({
      pathname: '/storyViewer',
      params: { 
        storyId: story.id,
        storyIndex: index,
        allStories: JSON.stringify(stories)
      }
    });
  };

  const renderStoryItem = ({ item, index }) => (
    <TouchableOpacity 
      style={styles.storyItem} 
      onPress={() => handleStoryPress(item, index)}
      activeOpacity={0.8}
    >
      <View style={[styles.storyContainer, !item.viewed && styles.unviewedStory]}>
        <Image 
          source={{ uri: `https://bh-alumni-social-media-app.onrender.com${item.mediaUrl}` }} 
          style={styles.storyImage}
          resizeMode="cover"
        />
        <View style={styles.storyOverlay}>
          <Text style={styles.userName}>{item.userName}</Text>
          <Text style={styles.timeStamp}>
            {getTimeAgo(item.createdAt)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const getTimeAgo = (date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now - new Date(date)) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <ActivityIndicator size="large" color="#2c3e50" />
        <Text style={styles.loadingText}>Loading stories...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <Text style={styles.errorText}>Unable to load stories</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchStories}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
{/* Header */}
<View style={styles.header}>
  <Image
    source={require('../../assets/BH-App-Icon.png')}
    style={styles.headerLogo}
    resizeMode="contain"
  />
  <Text style={styles.headerTitle}>Stories</Text>
  <TouchableOpacity style={styles.addButton} onPress={() => router.push('/createStory')}>
    <Text style={styles.addButtonText}>+ Add</Text>
  </TouchableOpacity>
</View>

      {stories.length === 0 ? (
        <View style={styles.emptyContainer}>
         <View style={styles.emptyContent}>
  <Text style={styles.emptyTitle}>No Stories Yet</Text>
            <Text style={styles.emptySubtitle}>Be the first to share a story</Text>
            <TouchableOpacity style={styles.createStoryButton} onPress={() => router.push('/createStory')}>
              <Text style={styles.createStoryButtonText}>Create Story</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={stories}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderStoryItem}
          numColumns={2}
          contentContainerStyle={styles.storiesGrid}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.row}
        />
      )}
    </View>
  );
};

export default Stories;

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
    fontSize: 18,
    fontWeight: '600',
    color: '#1a3a5c',
    letterSpacing: 0.5,
  },
addButton: {
    backgroundColor: '#3797EF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    color: '#e74c3c',
    fontWeight: '300',
    textAlign: 'center',
    marginBottom: 30,
    letterSpacing: 0.5,
  },
  retryButton: {
    backgroundColor: '#2c3e50',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyContent: {
    alignItems: 'center',
  },
  logo: {
    fontSize: 48,
    fontWeight: '100',
    color: '#2c3e50',
    letterSpacing: 8,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '300',
    color: '#2c3e50',
    marginBottom: 8,
    letterSpacing: 1,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '300',
    textAlign: 'center',
    marginBottom: 40,
    letterSpacing: 0.5,
  },
 createStoryButton: {
    backgroundColor: '#3797EF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 24,
  },
  createStoryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  storiesGrid: {
    padding: 20,
  },
  row: {
    justifyContent: 'space-between',
  },
  storyItem: {
    width: '48%',
    marginBottom: 16,
  },
storyContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    aspectRatio: 9/16,
    backgroundColor: '#f8f9fa',
    borderWidth: 3,
    borderColor: '#dbdbdb',
  },
unviewedStory: {
    borderColor: '#3797EF',
    borderWidth: 3,
  },
  storyImage: {
    width: '100%',
    height: '100%',
  },
  storyOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: 12,
  },
  userName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  timeStamp: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
  headerLogo: {
    width: 75,
    height: 75,
    borderRadius: 8,
  }
});