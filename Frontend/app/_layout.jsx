import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect } from 'react';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    const handleDeepLink = (event) => {
      const url = event.url;
      if (url.includes('reset-password')) {
        const token = url.split('token=')[1];
        if (token) {
          router.push({ pathname: '/resetPassword', params: { token } });
        }
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="forgotPassword" />
      <Stack.Screen name="resetPassword" />
      <Stack.Screen name="register" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="seeMessages" />
      <Stack.Screen name="newMessage" />
      <Stack.Screen name="createPosts" />
      <Stack.Screen name="createStory" />
      <Stack.Screen name="storyViewer" />
      <Stack.Screen name="storyPreview" />
      <Stack.Screen name="support" />
      <Stack.Screen name="userProfile" />
      <Stack.Screen name="postDetail" />
      <Stack.Screen name="shop" />
      <Stack.Screen name="cart" />
      <Stack.Screen name="checkout" />
      <Stack.Screen name="seeProduct" />
      <Stack.Screen name="orderDetails" />
    </Stack>
  );
}