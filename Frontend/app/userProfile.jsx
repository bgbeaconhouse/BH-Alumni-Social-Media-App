import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, FlatList, Image,
  TouchableOpacity, ActivityIndicator, StatusBar, Dimensions
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

const { width } = Dimensions.get('window');
const GRID_SIZE = (width - 3) / 3;

const UserProfile = () => {
  const { userId } = useLocalSearchParams();
  const router = useRouter();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    if (userId) fetchUserPosts();
  }, [userId]);

  const fetchUserPosts = async () => {
    try {
      const token = await SecureStore.getItemAsync('authToken');
      const response = await fetch(
        `https://bh-alumni-social-media-app.onrender.com/api/posts?userId=${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      const userPosts = data.posts || [];
      setPosts(userPosts);
      if (userPosts.length > 0 && userPosts[0].author) {
        const { firstName, lastName } = userPosts[0].author;
        setUserName(`${firstName} ${lastName || ''}`.trim());
      }
    } catch (error) {
      console.error('Error fetching user posts:', error);
    } finally {
      setLoading(false);
    }
  };

const renderGridItem = ({ item }) => {
    const imageUrl = item.imageAttachments?.[0]?.url
      ? `https://bh-alumni-social-media-app.onrender.com/uploads/${item.imageAttachments[0].url}`
      : null;

    const videoThumbnailUrl = item.videoAttachments?.[0]?.thumbnailUrl
      ? `https://bh-alumni-social-media-app.onrender.com/uploads/${item.videoAttachments[0].thumbnailUrl}`
      : null;

    const displayUrl = imageUrl || videoThumbnailUrl;
    const isVideo = !imageUrl && !!videoThumbnailUrl;

    return (
      <TouchableOpacity style={styles.gridItem} onPress={() => router.push({ pathname: '/postDetail', params: { postId: item.id } })}>
        {displayUrl ? (
          <View style={{ width: '100%', height: '100%' }}>
            <Image
              source={{ uri: displayUrl }}
              style={styles.gridImage}
              resizeMode="cover"
            />
            {isVideo && (
              <View style={styles.videoIndicator}>
                <Text style={styles.videoIndicatorText}>▶</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.textPost}>
            <Text style={styles.textPostContent} numberOfLines={3}>
              {item.content}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{userName || 'Profile'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Profile Info */}
      <View style={styles.profileSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {userName ? userName.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.fullName}>{userName}</Text>
          <Text style={styles.postCount}>{posts.length} posts</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {loading ? (
        <ActivityIndicator size="large" color="#1a3a5c" style={styles.loader} />
      ) : posts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No posts yet</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderGridItem}
          numColumns={3}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

export default UserProfile;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#dbdbdb',
    backgroundColor: '#ffffff',
  },
  backButton: {
    color: '#3797EF',
    fontSize: 15,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a3a5c',
    letterSpacing: 0.5,
  },
  headerSpacer: {
    width: 50,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a3a5c',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '600',
  },
  profileInfo: {
    flex: 1,
  },
  fullName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a3a5c',
    marginBottom: 4,
  },
  postCount: {
    fontSize: 14,
    color: '#1a3a5c',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#dbdbdb',
  },
  gridItem: {
    width: GRID_SIZE,
    height: GRID_SIZE,
    margin: 0.5,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  textPost: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f4f8',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  textPostContent: {
    fontSize: 12,
    color: '#1a3a5c',
    textAlign: 'center',
  },
  loader: {
    marginTop: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#7f8c8d',
    fontWeight: '300',
  },
  videoIndicator: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoIndicatorText: {
    color: '#ffffff',
    fontSize: 10,
  },
});