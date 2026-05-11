import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Image,
  TouchableOpacity, ActivityIndicator, StatusBar,
  TextInput, Alert
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { VideoView, useVideoPlayer } from 'expo-video';

const PostVideo = ({ videoUrl, thumbnailUrl }) => {
  const player = useVideoPlayer(videoUrl, player => {
    player.loop = false;
  });

  return (
    <VideoView
      player={player}
      style={styles.postVideo}
      allowsFullscreen
      allowsPictureInPicture
    />
  );
};


const BASE_URL = 'https://bh-alumni-social-media-app.onrender.com';

const PostDetail = () => {
  const { postId } = useLocalSearchParams();
  const router = useRouter();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [likes, setLikes] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    fetchPost();
    getCurrentUserId();
  }, [postId]);

  const getCurrentUserId = async () => {
    const token = await SecureStore.getItemAsync('authToken');
    if (token) {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join(''));
      const payload = JSON.parse(jsonPayload);
      setCurrentUserId(payload.id);
    }
  };

  const fetchPost = async () => {
    try {
      const token = await SecureStore.getItemAsync('authToken');
      const response = await fetch(`${BASE_URL}/api/posts/${postId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      setPost(data);
      setLikes(data.likes?.length || 0);
      setComments(data.comments || []);

      // Check if current user liked this post
      const token2 = await SecureStore.getItemAsync('authToken');
const likeResponse = await fetch(`${BASE_URL}/api/posts/${postId}/userLike`, {
  headers: { Authorization: `Bearer ${token}` }
});
if (likeResponse.ok) {
  const likeData = await likeResponse.json();
  setIsLiked(likeData.liked);
}
    } catch (error) {
      console.error('Error fetching post:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    try {
      const token = await SecureStore.getItemAsync('authToken');
      const response = await fetch(`${BASE_URL}/api/posts/${postId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        setIsLiked(!isLiked);
        setLikes(prev => isLiked ? prev - 1 : prev + 1);
      }
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync('authToken');
      const response = await fetch(`${BASE_URL}/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: newComment.trim() })
      });
      if (response.ok) {
        const data = await response.json();
        setComments(prev => [...prev, data]);
        setNewComment('');
      }
    } catch (error) {
      console.error('Error posting comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1a3a5c" />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Post not found</Text>
      </View>
    );
  }

  const imageAttachments = post.imageAttachments || [];
  const videoAttachments = post.videoAttachments || [];
  const authorName = post.author ? `${post.author.firstName} ${post.author.lastName || ''}`.trim() : 'Unknown';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Author */}
        <View style={styles.postHeader}>
          <View style={styles.authorInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {post.author?.firstName?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
            <Text style={styles.authorName}>{authorName}</Text>
          </View>
        </View>

        {/* Image */}
        {imageAttachments.length > 0 && (
          <Image
            source={{ uri: `${BASE_URL}/uploads/${imageAttachments[0].url}` }}
            style={styles.postImage}
            resizeMode="cover"
          />
        )}

        {/* Video */}
  {videoAttachments.length > 0 && (
  <PostVideo
    videoUrl={`${BASE_URL}/uploads/${videoAttachments[0].url}`}
    thumbnailUrl={videoAttachments[0].thumbnailUrl
      ? `${BASE_URL}/uploads/${videoAttachments[0].thumbnailUrl}`
      : null}
  />
)}

        {/* Interactions */}
        <View style={styles.interactions}>
          <TouchableOpacity style={styles.interactionButton} onPress={handleLike}>
            <Text style={styles.interactionIcon}>{isLiked ? '❤️' : '🤍'}</Text>
            <Text style={[styles.interactionCount, isLiked && styles.likedText]}>{likes}</Text>
          </TouchableOpacity>
          <View style={styles.interactionButton}>
            <Text style={styles.interactionIcon}>💬</Text>
            <Text style={styles.interactionCount}>{comments.length}</Text>
          </View>
        </View>

        {/* Post text */}
        {post.content && <Text style={styles.postContent}>{post.content}</Text>}

        {/* Comments */}
        <View style={styles.commentsSection}>
          {comments.map((comment) => (
            <View key={comment.id} style={styles.commentItem}>
              <Text style={styles.commentAuthor}>
                {comment.user ? `${comment.user.firstName} ${comment.user.lastName || ''}` : 'Unknown'}
              </Text>
              <Text style={styles.commentText}>{comment.content}</Text>
            </View>
          ))}
        </View>

        {/* New Comment */}
        <View style={styles.newCommentContainer}>
          <TextInput
            style={styles.newCommentInput}
            placeholder="Add a comment..."
            placeholderTextColor="#aaaaaa"
            value={newComment}
            onChangeText={setNewComment}
          />
          <TouchableOpacity
            style={styles.postCommentButton}
            onPress={handlePostComment}
            disabled={submitting}
          >
            <Text style={styles.postCommentButtonText}>{submitting ? '...' : 'Post'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default PostDetail;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#7f8c8d' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#dbdbdb',
  },
  backButton: { color: '#3797EF', fontSize: 15, fontWeight: '500' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1a3a5c' },
  headerSpacer: { width: 50 },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  authorInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1a3a5c',
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  avatarText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  authorName: { fontSize: 15, fontWeight: '700', color: '#1a3a5c' },
  postImage: { width: '100%', aspectRatio: 1 },
  postVideo: { width: '100%', aspectRatio: 16/9 },
  interactions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  interactionButton: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
  interactionIcon: { fontSize: 22, marginRight: 4 },
  interactionCount: { fontSize: 14, color: '#1a3a5c', fontWeight: '500' },
  likedText: { color: '#e74c3c' },
  postContent: {
    fontSize: 15, color: '#1a3a5c', lineHeight: 22,
    paddingHorizontal: 12, marginBottom: 12,
  },
  commentsSection: {
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#dbdbdb',
    paddingTop: 12,
  },
  commentItem: { marginBottom: 12 },
  commentAuthor: { fontSize: 13, fontWeight: '600', color: '#1a3a5c', marginBottom: 2 },
  commentText: { fontSize: 14, color: '#2c3e50', lineHeight: 20 },
  newCommentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#dbdbdb',
    marginTop: 8,
  },
  newCommentInput: {
    flex: 1,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#dbdbdb',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1a3a5c',
    marginRight: 10,
  },
  postCommentButton: {
    backgroundColor: '#3797EF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  postCommentButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
});