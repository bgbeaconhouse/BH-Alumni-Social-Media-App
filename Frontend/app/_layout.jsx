import { Stack } from 'expo-router';

export default function RootLayout() {
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