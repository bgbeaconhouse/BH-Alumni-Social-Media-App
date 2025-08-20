import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  Image, 
  TouchableOpacity, 
  Dimensions, 
  StatusBar,
  PanGestureHandler,
  Animated,
  Alert
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as SecureStore from 'expo-secure-store';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const StoryViewer = () => {
  const { storyId, storyIndex, allStories } = useLocalSearchParams();
  const router = useRouter();
  
  const [stories, setStories] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressTimer = useRef(null);

  // Create video player for current story - MOVED OUTSIDE CONDITIONAL RENDERING
  const currentStory = stories[currentIndex] || null;
  const videoUrl = currentStory?.mediaType === 'video' 
    ? `https://bh-alumni-social-media-app.onrender.com${currentStory.mediaUrl}` 
    : null;
    
  const player = useVideoPlayer(videoUrl, (player) => {
    if (videoUrl) {
      player.loop = false;
      player.muted = false;
    }
  });

  const STORY_DURATION = 5000; // 5 seconds per story

  useEffect(() => {
    if (allStories) {
      try {
        const parsedStories = JSON.parse(allStories);
        console.log('🔍 DEBUG: Parsed stories:', parsedStories);
        console.log('🔍 DEBUG: Current story:', parsedStories[parseInt(storyIndex) || 0]);
        setStories(parsedStories);
        setCurrentIndex(parseInt(storyIndex) || 0);
      } catch (error) {
        console.error('Error parsing stories:', error);
        router.push('/stories');
      }
    }
  }, [allStories, storyIndex]);

  const markStoryAsViewed = async (story) => {
    // Don't mark own stories as viewed
    if (story.isOwnStory) {
      return;
    }

    try {
      const token = await SecureStore.getItemAsync('authToken');
      if (!token) return;

      console.log(`👁️ Marking story ${story.id} as viewed`);

      const response = await fetch(`https://bh-alumni-social-media-app.onrender.com/api/stories/${story.id}/view`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        console.log('✅ Story marked as viewed');
      }
    } catch (error) {
      console.error('Error marking story as viewed:', error);
    }
  };

  useEffect(() => {
    if (stories.length > 0) {
      startProgress();
      markStoryAsViewed(stories[currentIndex]);
      
      // Start video if it's a video story
      const story = stories[currentIndex];
      if (story?.mediaType === 'video' && player) {
        console.log('🎬 Starting video playback for story:', story.id);
        player.play();
      }
    }
    return () => {
      if (progressTimer.current) {
        clearTimeout(progressTimer.current);
      }
    };
  }, [currentIndex, stories, player]);

  const startProgress = () => {
    // Reset progress
    progressAnim.setValue(0);
    setProgress(0);
    
    // Clear existing timer
    if (progressTimer.current) {
      clearTimeout(progressTimer.current);
    }

    // Start progress animation
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    }).start(() => {
      // Auto advance to next story
      handleNextStory();
    });

    // Update progress state for visual feedback
    const startTime = Date.now();
    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min(elapsed / STORY_DURATION, 1);
      setProgress(newProgress);
      
      if (newProgress < 1) {
        progressTimer.current = setTimeout(updateProgress, 50);
      }
    };
    updateProgress();
  };

  const handleNextStory = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // End of stories, go back to stories page specifically
      router.push('/stories');
    }
  };

  const handlePreviousStory = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else {
      // First story, go back to stories page specifically
      router.push('/stories');
    }
  };

  const handleTapLeft = () => {
    handlePreviousStory();
  };

  const handleTapRight = () => {
    handleNextStory();
  };

  const handleClose = () => {
    router.push('/stories');
  };

  const handleDeleteStory = () => {
    Alert.alert(
      'Delete Story',
      'Are you sure you want to delete this story?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await SecureStore.getItemAsync('authToken');
              if (!token) {
                Alert.alert('Error', 'Authentication required');
                return;
              }

              console.log(`🗑️ Deleting story ${currentStory.id}`);

              const response = await fetch(`https://bh-alumni-social-media-app.onrender.com/api/stories/${currentStory.id}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              });

              if (response.ok) {
                console.log('✅ Story deleted successfully');
                Alert.alert('Success', 'Story deleted successfully', [
                  {
                    text: 'OK',
                    onPress: () => router.push('/stories')
                  }
                ]);
              } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete story');
              }
            } catch (error) {
              console.error('❌ Error deleting story:', error);
              Alert.alert('Error', error.message || 'Failed to delete story');
            }
          }
        }
      ]
    );
  };

  if (stories.length === 0 || currentIndex >= stories.length || !currentStory) {
    return null;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* Story Media - Support both images and videos */}
      {currentStory.mediaType === 'video' ? (
        <VideoView
          style={styles.storyImage}
          player={player}
          allowsFullscreen={false}
          showsTimecodes={false}
          requiresLinearPlayback={false}
        />
      ) : (
        <Image 
          source={{ uri: `https://bh-alumni-social-media-app.onrender.com${currentStory.mediaUrl}` }} 
          style={styles.storyImage}
          resizeMode="cover"
        />
      )}

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        {stories.map((_, index) => (
          <View key={index} style={styles.progressBarBackground}>
            <View 
              style={[
                styles.progressBar,
                {
                  width: index < currentIndex 
                    ? '100%' 
                    : index === currentIndex 
                      ? `${progress * 100}%` 
                      : '0%'
                }
              ]} 
            />
          </View>
        ))}
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {currentStory.userName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{currentStory.userName}</Text>
            <Text style={styles.timeStamp}>
              {getTimeAgo(currentStory.createdAt)}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          {/* Show delete button only for own stories */}
          {currentStory.isOwnStory && (
            <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteStory}>
              <Text style={styles.deleteButtonText}>🗑️</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tap Areas */}
      <TouchableOpacity 
        style={styles.tapAreaLeft} 
        onPress={handleTapLeft}
        activeOpacity={1}
      />
      <TouchableOpacity 
        style={styles.tapAreaRight} 
        onPress={handleTapRight}
        activeOpacity={1}
      />

      {/* Story Counter */}
      <View style={styles.storyCounter}>
        <Text style={styles.counterText}>
          {currentIndex + 1} of {stories.length}
        </Text>
      </View>
    </View>
  );
};

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

export default StoryViewer;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  storyImage: {
    width: screenWidth,
    height: screenHeight,
    position: 'absolute',
  },
  progressContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    zIndex: 10,
  },
  progressBarBackground: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 2,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 1.5,
  },
  header: {
    position: 'absolute',
    top: 70,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2c3e50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    color: '#ffffff',
    fontSize: 16,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 24,
  },
  tapAreaLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: screenWidth / 2,
    height: screenHeight,
    zIndex: 5,
  },
  tapAreaRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: screenWidth / 2,
    height: screenHeight,
    zIndex: 5,
  },
  storyCounter: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 10,
  },
  counterText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
});