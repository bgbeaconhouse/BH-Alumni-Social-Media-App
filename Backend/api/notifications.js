const express = require("express");
const router = express.Router();
const { Expo } = require('expo-server-sdk');
const prisma = require("../prisma");
const verifyToken = require("../verify");

// Create a new Expo SDK client
const expo = new Expo();

// Register or update push token for a user
router.post("/register-token", verifyToken, async (req, res, next) => {
    try {
        const { token, deviceId, platform } = req.body;
        const userId = req.userId;

        // Validate the Expo push token
        if (!Expo.isExpoPushToken(token)) {
            return res.status(400).json({ 
                error: 'Invalid Expo push token',
                message: 'The provided token is not a valid Expo push token' 
            });
        }

        // Upsert the push token
        const newToken = await prisma.pushToken.upsert({
            where: { 
                token: token 
            },
            update: {
                userId: userId,
                deviceId: deviceId,
                platform: platform,
                isActive: true,
                updatedAt: new Date()
            },
            create: {
                userId: userId,
                token: token,
                deviceId: deviceId,
                platform: platform,
                isActive: true
            }
        });

        console.log(`Push token registered for user ${userId}:`, token);
        return res.status(201).json({ 
            message: 'Push token registered successfully',
            tokenId: newToken.id 
        });

    } catch (error) {
        console.error('Error registering push token:', error);
        next(error);
    }
});

// Remove push token (when user logs out or uninstalls)
router.delete("/remove-token", verifyToken, async (req, res, next) => {
    try {
        const { token } = req.body;
        const userId = req.userId;

        await prisma.pushToken.deleteMany({
            where: {
                userId: userId,
                token: token
            }
        });

        res.status(200).json({ message: 'Push token removed successfully' });

    } catch (error) {
        console.error('Error removing push token:', error);
        next(error);
    }
});

// Get user's notification settings
router.get("/settings", verifyToken, async (req, res, next) => {
    try {
        const userId = req.userId;

        let settings = await prisma.notificationSettings.findUnique({
            where: { userId: userId }
        });

        // If no settings exist, create default ones
        if (!settings) {
            settings = await prisma.notificationSettings.create({
                data: {
                    userId: userId,
                    enablePostNotifications: true,
                    enableMessageNotifications: true,
                    enableCommentNotifications: true,
                    enableLikeNotifications: true
                }
            });
        }

        res.status(200).json(settings);

    } catch (error) {
        console.error('Error fetching notification settings:', error);
        next(error);
    }
});

// Update user's notification settings
router.put("/settings", verifyToken, async (req, res, next) => {
    try {
        const userId = req.userId;
        const {
            enablePostNotifications,
            enableMessageNotifications,
            enableCommentNotifications,
            enableLikeNotifications,
            quietHoursStart,
            quietHoursEnd,
            timezone
        } = req.body;

        const updatedSettings = await prisma.notificationSettings.upsert({
            where: { userId: userId },
            update: {
                enablePostNotifications,
                enableMessageNotifications,
                enableCommentNotifications,
                enableLikeNotifications,
                quietHoursStart,
                quietHoursEnd,
                timezone,
                updatedAt: new Date()
            },
            create: {
                userId: userId,
                enablePostNotifications: enablePostNotifications ?? true,
                enableMessageNotifications: enableMessageNotifications ?? true,
                enableCommentNotifications: enableCommentNotifications ?? true,
                enableLikeNotifications: enableLikeNotifications ?? true,
                quietHoursStart,
                quietHoursEnd,
                timezone
            }
        });

        res.status(200).json(updatedSettings);

    } catch (error) {
        console.error('Error updating notification settings:', error);
        next(error);
    }
});

// Get unread counts for current user
router.get("/unread-counts", verifyToken, async (req, res, next) => {
    try {
        const userId = req.userId;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                unreadPostsCount: true,
                unreadMessagesCount: true,
                lastPostViewedAt: true
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json(user);

    } catch (error) {
        console.error('Error fetching unread counts:', error);
        next(error);
    }
});

// Mark posts as read (reset unread posts count)
router.post("/mark-posts-read", verifyToken, async (req, res, next) => {
    try {
        const userId = req.userId;

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                unreadPostsCount: 0,
                lastPostViewedAt: new Date()
            }
        });

        console.log(`Posts marked as read for user ${userId}`);
        res.status(200).json({ 
            message: 'Posts marked as read',
            unreadPostsCount: updatedUser.unreadPostsCount 
        });

    } catch (error) {
        console.error('Error marking posts as read:', error);
        next(error);
    }
});

// Mark conversation as read (update lastReadAt for conversation member)
router.post("/mark-conversation-read/:conversationId", verifyToken, async (req, res, next) => {
    try {
        const userId = req.userId;
        const conversationId = parseInt(req.params.conversationId);

        console.log(`Marking conversation ${conversationId} as read for user ${userId}`);

        // First, verify the user is a member of this conversation
        const membership = await prisma.conversationMember.findFirst({
            where: {
                userId: userId,
                conversationId: conversationId
            }
        });

        if (!membership) {
            console.log(`User ${userId} is not a member of conversation ${conversationId}`);
            return res.status(403).json({ message: 'Not a member of this conversation' });
        }

        // Update the conversation member's lastReadAt
        await prisma.conversationMember.updateMany({
            where: {
                userId: userId,
                conversationId: conversationId
            },
            data: {
                lastReadAt: new Date()
            }
        });

        console.log(`Updated lastReadAt for user ${userId} in conversation ${conversationId}`);

        // Recalculate total unread messages count for this user
        const newUnreadCount = await recalculateUnreadMessagesCount(userId);

        // Update user's total unread messages count
        await prisma.user.update({
            where: { id: userId },
            data: {
                unreadMessagesCount: newUnreadCount
            }
        });

        console.log(`Updated user ${userId} unread messages count to ${newUnreadCount}`);

        res.status(200).json({ 
            message: 'Conversation marked as read',
            unreadMessagesCount: newUnreadCount
        });

    } catch (error) {
        console.error('Error marking conversation as read:', error);
        next(error);
    }
});

// Get notification history for user
router.get("/history", verifyToken, async (req, res, next) => {
    try {
        const userId = req.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const notifications = await prisma.notification.findMany({
            where: { receiverId: userId },
            include: {
                sender: {
                    select: { id: true, firstName: true, lastName: true, username: true }
                },
                post: {
                    select: { id: true, content: true }
                },
                message: {
                    select: { id: true, content: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
        });

        const totalNotifications = await prisma.notification.count({
            where: { receiverId: userId }
        });

        res.status(200).json({
            notifications,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalNotifications / limit),
                totalNotifications,
                hasMore: skip + notifications.length < totalNotifications
            }
        });

    } catch (error) {
        console.error('Error fetching notification history:', error);
        next(error);
    }
});

// Mark notification as read
router.put("/:notificationId/read", verifyToken, async (req, res, next) => {
    try {
        const userId = req.userId;
        const notificationId = parseInt(req.params.notificationId);

        const notification = await prisma.notification.findFirst({
            where: {
                id: notificationId,
                receiverId: userId
            }
        });

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        const updatedNotification = await prisma.notification.update({
            where: { id: notificationId },
            data: {
                isRead: true,
                readAt: new Date()
            }
        });

        res.status(200).json(updatedNotification);

    } catch (error) {
        console.error('Error marking notification as read:', error);
        next(error);
    }
});

// Utility function to recalculate unread messages count for a user
const recalculateUnreadMessagesCount = async (userId) => {
    try {
        console.log(`Recalculating unread messages for user ${userId}`);

        // Get all conversation members for this user with their lastReadAt
        const conversationMembers = await prisma.conversationMember.findMany({
            where: { userId: userId },
            select: {
                conversationId: true,
                lastReadAt: true
            }
        });

        console.log(`Found ${conversationMembers.length} conversations for user ${userId}`);

        let totalUnreadMessages = 0;

        for (const member of conversationMembers) {
            // Count messages in this conversation that are newer than lastReadAt
            const unreadInConversation = await prisma.message.count({
                where: {
                    conversationId: member.conversationId,
                    senderId: { not: userId }, // Don't count own messages
                    createdAt: { gt: member.lastReadAt || new Date(0) } // If null, use epoch
                }
            });

            console.log(`Conversation ${member.conversationId}: ${unreadInConversation} unread messages`);
            totalUnreadMessages += unreadInConversation;
        }

        console.log(`Total unread messages for user ${userId}: ${totalUnreadMessages}`);
        return totalUnreadMessages;

    } catch (error) {
        console.error('Error recalculating unread messages count:', error);
        return 0;
    }
};

// Debug route to check specific conversation details
router.get("/debug-conversation/:conversationId", verifyToken, async (req, res, next) => {
    try {
        const userId = req.userId;
        const conversationId = parseInt(req.params.conversationId);

        console.log(`🔍 Debugging conversation ${conversationId} for user ${userId}`);

        // Get conversation member info
        const conversationMember = await prisma.conversationMember.findFirst({
            where: {
                userId: userId,
                conversationId: conversationId
            }
        });

        if (!conversationMember) {
            return res.status(404).json({ error: 'User not in this conversation' });
        }

        console.log(`📅 User's lastReadAt: ${conversationMember.lastReadAt}`);

        // Get all messages in this conversation from other users
        const messages = await prisma.message.findMany({
            where: {
                conversationId: conversationId,
                senderId: { not: userId } // Don't count own messages
            },
            orderBy: { createdAt: 'desc' },
            include: {
                sender: {
                    select: { id: true, firstName: true, lastName: true }
                }
            }
        });

        console.log(`📨 Total messages from others: ${messages.length}`);

        // Check which messages are unread
        const unreadMessages = messages.filter(msg => 
            new Date(msg.createdAt) > new Date(conversationMember.lastReadAt)
        );

        console.log(`📬 Unread messages: ${unreadMessages.length}`);

        // Log details of each message
        messages.forEach((msg, index) => {
            const isUnread = new Date(msg.createdAt) > new Date(conversationMember.lastReadAt);
            console.log(`📝 Message ${index + 1}: ${msg.createdAt} (${isUnread ? 'UNREAD' : 'read'}) from ${msg.sender.firstName}`);
        });

        const debugInfo = {
            conversationId,
            userId,
            lastReadAt: conversationMember.lastReadAt,
            totalMessagesFromOthers: messages.length,
            unreadCount: unreadMessages.length,
            messages: messages.map(msg => ({
                id: msg.id,
                createdAt: msg.createdAt,
                content: msg.content?.substring(0, 50) + '...',
                sender: msg.sender.firstName,
                isUnread: new Date(msg.createdAt) > new Date(conversationMember.lastReadAt)
            }))
        };

        res.status(200).json(debugInfo);

    } catch (error) {
        console.error('Error debugging conversation:', error);
        next(error);
    }
});

// Add this route to your backend api/notifications.js

// Route to reset all unread counts for a user (for testing/debugging)
router.post("/reset-unread-counts", verifyToken, async (req, res, next) => {
    try {
        const userId = req.userId;

        console.log(`🔄 Resetting all unread counts for user ${userId}`);

        // Update all conversation members to current time
        await prisma.conversationMember.updateMany({
            where: { userId: userId },
            data: { lastReadAt: new Date() }
        });

        // Reset user's unread counts to 0
        await prisma.user.update({
            where: { id: userId },
            data: {
                unreadPostsCount: 0,
                unreadMessagesCount: 0,
                lastPostViewedAt: new Date()
            }
        });

        console.log(`✅ Reset complete for user ${userId}`);

        res.status(200).json({ 
            message: 'All unread counts reset to 0',
            userId: userId 
        });

    } catch (error) {
        console.error('Error resetting unread counts:', error);
        next(error);
    }
});

// Route to manually recalculate unread counts for a user
router.post("/recalculate-unread-counts", verifyToken, async (req, res, next) => {
    try {
        const userId = req.userId;

        console.log(`🧮 Manually recalculating unread counts for user ${userId}`);

        // Use the existing recalculateUnreadMessagesCount function
        const newUnreadCount = await recalculateUnreadMessagesCount(userId);

        res.status(200).json({ 
            message: 'Unread counts recalculated',
            userId: userId,
            newUnreadMessagesCount: newUnreadCount
        });

    } catch (error) {
        console.error('Error recalculating unread counts:', error);
        next(error);
    }
});
router.post("/debug-increment-posts/:userId", verifyToken, async (req, res, next) => {
    try {
        const userId = parseInt(req.params.userId);
        
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                unreadPostsCount: { increment: 1 }
            }
        });

        console.log(`Debug: Incremented unread posts for user ${userId} to ${updatedUser.unreadPostsCount}`);
        
        res.status(200).json({ 
            message: 'Debug increment successful',
            newCount: updatedUser.unreadPostsCount 
        });
    } catch (error) {
        console.error('Error in debug increment:', error);
        next(error);
    }
});

// Add this debugging route to your backend/api/notifications.js
// This will help us see what push tokens are registered and for which users

router.get("/debug-tokens", verifyToken, async (req, res, next) => {
    try {
        const userId = req.userId;
        console.log(`🔍 DEBUG: Checking push tokens for requesting user ${userId}`);

        // Get all push tokens in the system
        const allTokens = await prisma.pushToken.findMany({
            include: {
                user: {
                    select: { id: true, firstName: true, lastName: true, username: true }
                }
            },
            orderBy: { userId: 'asc' }
        });

        console.log('📱 ALL PUSH TOKENS IN SYSTEM:');
        allTokens.forEach(token => {
            console.log(`   User: ${token.user.id} (${token.user.firstName}) - Token: ${token.token.substring(0, 30)}... - Active: ${token.isActive}`);
        });

        // Check for duplicate tokens
        const tokenMap = new Map();
        allTokens.forEach(token => {
            if (tokenMap.has(token.token)) {
                console.log(`⚠️ DUPLICATE TOKEN FOUND: ${token.token.substring(0, 30)}... used by users ${tokenMap.get(token.token)} and ${token.user.id}`);
            } else {
                tokenMap.set(token.token, token.user.id);
            }
        });

        // Get current user's tokens specifically
        const userTokens = allTokens.filter(token => token.userId === userId);
        console.log(`👤 CURRENT USER (${userId}) TOKENS:`, userTokens.length);

        res.json({
            requestingUserId: userId,
            totalTokens: allTokens.length,
            currentUserTokens: userTokens.length,
            allTokens: allTokens.map(token => ({
                userId: token.userId,
                userName: token.user.firstName,
                tokenPreview: token.token.substring(0, 30) + '...',
                isActive: token.isActive,
                platform: token.platform
            })),
            duplicateTokens: Array.from(tokenMap.entries()).filter(([token, userId]) => 
                allTokens.filter(t => t.token === token).length > 1
            )
        });

    } catch (error) {
        console.error('❌ Error debugging push tokens:', error);
        next(error);
    }
});

// Also add this simple route to check if the current user has a valid session
router.get("/debug-user", verifyToken, async (req, res, next) => {
    try {
        const userId = req.userId;
        const username = req.username;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                pushTokens: {
                    where: { isActive: true },
                    select: { id: true, token: true, platform: true }
                }
            }
        });

        console.log(`🔍 DEBUG USER SESSION:`, {
            tokenUserId: userId,
            tokenUsername: username,
            dbUser: user
        });

        res.json({
            tokenData: { userId, username },
            dbUser: user,
            hasValidSession: !!user,
            activePushTokens: user?.pushTokens?.length || 0
        });

    } catch (error) {
        console.error('❌ Error debugging user session:', error);
        next(error);
    }
});

// Export utility functions for use in other routes
module.exports = {
    router,
    recalculateUnreadMessagesCount
};