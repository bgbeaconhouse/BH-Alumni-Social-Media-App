const { Expo } = require('expo-server-sdk');
const prisma = require("../prisma");

// Create a new Expo SDK client
const expo = new Expo();

class NotificationService {
    
    /**
     * Send notification when a new post is created
     * @param {Object} post - The created post object
     * @param {Object} author - The post author object
     */
  static async sendNewPostNotification(post, author) {
    try {
        console.log('🆕 SENDING NEW POST NOTIFICATION for post:', post.id);
        
        // Get all users except the post author
        const users = await prisma.user.findMany({
            where: {
                id: { not: post.authorId },
                approved: true // Only send to approved users
            },
            include: {
                notificationSettings: true,
                pushTokens: {
                    where: { isActive: true }
                }
            }
        });

        console.log(`👥 Found ${users.length} users to notify`);

        const notifications = [];
        const pushMessages = [];

        for (const user of users) {
            // Check if user has post notifications enabled
            const settings = user.notificationSettings;
            if (settings && !settings.enablePostNotifications) {
                console.log(`⏭️ Skipping user ${user.id} - post notifications disabled`);
                continue;
            }

            // Check quiet hours
            if (this.isQuietHours(settings)) {
                console.log(`🤫 Skipping user ${user.id} - in quiet hours`);
                continue;
            }

            // Create notification record in database
            const notification = await prisma.notification.create({
                data: {
                    senderId: post.authorId,
                    receiverId: user.id,
                    title: 'New Post',
                    body: `${author.firstName} ${author.lastName} shared a new post`,
                    type: 'NEW_POST',
                    postId: post.id
                }
            });

            notifications.push(notification);

            // Increment unread posts count
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    unreadPostsCount: { increment: 1 }
                }
            });

            console.log(`📊 Updated unread count for user ${user.id}`);

            // Calculate badge count
            const badgeCount = await this.calculateTotalBadgeCount(user.id);
            console.log(`🔢 Badge count for user ${user.id}: ${badgeCount}`);

            // Prepare push notifications for each device token
            for (const pushToken of user.pushTokens) {
                if (Expo.isExpoPushToken(pushToken.token)) {
                    // 🔥 IMPROVED PAYLOAD FORMAT
                    const pushMessage = {
                        to: pushToken.token,
                        sound: 'default',
                        title: 'New Post',
                        body: `${author.firstName} shared a new post`,
                        data: {
                            type: 'NEW_POST',
                            postId: post.id,
                            notificationId: notification.id,
                            // Add these for better handling
                            screen: 'post',
                            timestamp: new Date().toISOString()
                        },
                        badge: badgeCount,
                        // 🔥 ADD THESE CRITICAL FIELDS
                        priority: 'high',
                        channelId: 'default', // For Android
                        // Ensure notification shows even if app is foreground
                        _displayInForeground: true
                    };

                    console.log(`📱 Adding push message for user ${user.id}, token: ${pushToken.token.substring(0, 20)}...`);
                    pushMessages.push(pushMessage);
                } else {
                    console.log(`❌ Invalid push token for user ${user.id}: ${pushToken.token}`);
                }
            }
        }

        console.log(`📨 Prepared ${pushMessages.length} push messages`);

        // Send push notifications in batches
        if (pushMessages.length > 0) {
            await this.sendPushNotifications(pushMessages, notifications);
        } else {
            console.log('⚠️ No push messages to send');
        }

        console.log(`✅ Sent ${notifications.length} new post notifications for post ${post.id}`);
        return notifications;

    } catch (error) {
        console.error('❌ Error sending new post notification:', error);
        throw error;
    }
}

    /**
     * Send notification when a new message is sent
     * @param {Object} message - The created message object
     * @param {Object} sender - The message sender object
     */
// Replace your sendNewMessageNotification method in backend/services/notificationService.js with this:

static async sendNewMessageNotification(message, sender) {
    try {
        console.log(`📩 SENDING MESSAGE NOTIFICATION for message ${message.id} from sender ${sender.id}`);
        console.log(`🔍 Message senderId: ${message.senderId} (type: ${typeof message.senderId})`);
        console.log(`🔍 Sender ID: ${sender.id} (type: ${typeof sender.id})`);
        
        // 🔥 CRITICAL FIX: Ensure both IDs are the same type
        const senderIdInt = parseInt(message.senderId);
        console.log(`🔧 Converting senderId to integer: ${senderIdInt}`);
        
        // Get conversation members except the sender - FIXED QUERY
        const conversationMembers = await prisma.conversationMember.findMany({
            where: {
                conversationId: message.conversationId,
                // 🔥 FIX: Use integer comparison and add extra safety
                AND: [
                    { userId: { not: senderIdInt } },
                    { userId: { not: parseInt(sender.id) } } // Double check with sender.id too
                ]
            },
            include: {
                user: {
                    include: {
                        notificationSettings: true,
                        pushTokens: {
                            where: { isActive: true }
                        }
                    }
                }
            }
        });

        console.log(`👥 Found ${conversationMembers.length} conversation members (excluding sender)`);

        // 🔥 ADDITIONAL SAFETY: Filter out sender on the JavaScript side too
        const filteredMembers = conversationMembers.filter(member => {
            const memberUserId = parseInt(member.user.id);
            const senderUserId = parseInt(sender.id);
            const messageSenderId = parseInt(message.senderId);
            
            const shouldInclude = memberUserId !== senderUserId && memberUserId !== messageSenderId;
            
            if (!shouldInclude) {
                console.log(`⚠️ FILTERING OUT sender from members: User ${memberUserId}, Sender ${senderUserId}, Message Sender ${messageSenderId}`);
            }
            
            return shouldInclude;
        });

        console.log(`🔒 After filtering: ${filteredMembers.length} valid recipients`);

        const notifications = [];
        const pushMessages = [];

        for (const member of filteredMembers) {
            const user = member.user;

            // 🔥 TRIPLE CHECK: Make sure we're not sending to sender
            if (parseInt(user.id) === parseInt(sender.id) || parseInt(user.id) === parseInt(message.senderId)) {
                console.log(`❌ CRITICAL ERROR: Almost sent notification to sender! User: ${user.id}, Sender: ${sender.id}, Message Sender: ${message.senderId}`);
                continue; // Skip this user
            }

            console.log(`✅ Processing notification for user ${user.id} (${user.firstName})`);

            // Check notification settings
            const settings = user.notificationSettings;
            if (settings && !settings.enableMessageNotifications) {
                console.log(`⏭️ Message notifications disabled for user ${user.id}`);
                continue;
            }

            if (this.isQuietHours(settings)) {
                console.log(`🤫 User ${user.id} is in quiet hours`);
                continue;
            }

            // Create notification record
            const notification = await prisma.notification.create({
                data: {
                    senderId: parseInt(message.senderId),
                    receiverId: parseInt(user.id),
                    title: 'New Message',
                    body: `${sender.firstName}: ${message.content ? 
                        (message.content.length > 50 ? message.content.substring(0, 50) + '...' : message.content) : 
                        'Sent an attachment'}`,
                    type: 'NEW_MESSAGE',
                    messageId: message.id,
                    conversationId: message.conversationId
                }
            });

            notifications.push(notification);

            // Increment unread messages count
            await prisma.user.update({
                where: { id: parseInt(user.id) },
                data: {
                    unreadMessagesCount: { increment: 1 }
                }
            });

            console.log(`📊 Updated unread count for user ${user.id}`);

            // Calculate badge count
            const badgeCount = await this.calculateTotalBadgeCount(user.id);

            // Prepare push notifications
            for (const pushToken of user.pushTokens) {
                if (Expo.isExpoPushToken(pushToken.token)) {
                    const pushMessage = {
                        to: pushToken.token,
                        sound: 'default',
                        title: 'New Message',
                        body: `${sender.firstName}: ${message.content ? 
                            (message.content.length > 50 ? message.content.substring(0, 50) + '...' : message.content) : 
                            'Sent an attachment'}`,
                        data: {
                            type: 'NEW_MESSAGE',
                            messageId: message.id,
                            conversationId: message.conversationId,
                            notificationId: notification.id,
                            screen: 'seeMessages',
                            timestamp: new Date().toISOString()
                        },
                        badge: badgeCount,
                        priority: 'high',
                        channelId: 'default',
                        _displayInForeground: true
                    };

                    console.log(`📱 Adding push message for user ${user.id}`);
                    pushMessages.push(pushMessage);
                }
            }
        }

        // Send push notifications
        if (pushMessages.length > 0) {
            console.log(`📨 Sending ${pushMessages.length} push notifications`);
            await this.sendPushNotifications(pushMessages, notifications);
        } else {
            console.log(`⚠️ No push messages to send - all recipients filtered out or no valid tokens`);
        }

        console.log(`✅ Sent ${notifications.length} new message notifications for message ${message.id}`);
        return notifications;

    } catch (error) {
        console.error('❌ Error sending new message notification:', error);
        throw error;
    }
}

    /**
     * Send notification when someone comments on a post
     * @param {Object} comment - The created comment object
     * @param {Object} commenter - The comment author object
     * @param {Object} post - The post being commented on
     */
    static async sendNewCommentNotification(comment, commenter, post) {
        try {
            // Only notify the post author (not other commenters for now)
            if (comment.userId === post.authorId) {
                return; // Don't notify if commenting on own post
            }

            const postAuthor = await prisma.user.findUnique({
                where: { id: post.authorId },
                include: {
                    notificationSettings: true,
                    pushTokens: {
                        where: { isActive: true }
                    }
                }
            });

            if (!postAuthor) return;

            // Check notification settings
            const settings = postAuthor.notificationSettings;
            if (settings && !settings.enableCommentNotifications) {
                return;
            }

            // Check quiet hours
            if (this.isQuietHours(settings)) {
                return;
            }

            // Create notification
            const notification = await prisma.notification.create({
                data: {
                    senderId: comment.userId,
                    receiverId: post.authorId,
                    title: 'New Comment',
                    body: `${commenter.firstName} commented on your post`,
                    type: 'NEW_COMMENT',
                    postId: post.id
                }
            });

            // Send push notification
            const pushMessages = [];
            for (const pushToken of postAuthor.pushTokens) {
                if (Expo.isExpoPushToken(pushToken.token)) {
                    pushMessages.push({
                        to: pushToken.token,
                        sound: 'default',
                        title: 'New Comment',
                        body: `${commenter.firstName} commented on your post`,
                        data: {
                            type: 'NEW_COMMENT',
                            postId: post.id,
                            notificationId: notification.id
                        },
                        badge: await this.calculateTotalBadgeCount(postAuthor.id)
                    });
                }
            }

            if (pushMessages.length > 0) {
                await this.sendPushNotifications(pushMessages, [notification]);
            }

            console.log(`Sent comment notification to post author ${post.authorId}`);
            return notification;

        } catch (error) {
            console.error('Error sending comment notification:', error);
            throw error;
        }
    }

    /**
     * Send notification when someone likes a post
     * @param {Object} like - The created like object
     * @param {Object} liker - The user who liked the post
     * @param {Object} post - The post being liked
     */
    static async sendNewLikeNotification(like, liker, post) {
        try {
            // Don't notify if liking own post
            if (like.userId === post.authorId) {
                return;
            }

            const postAuthor = await prisma.user.findUnique({
                where: { id: post.authorId },
                include: {
                    notificationSettings: true,
                    pushTokens: {
                        where: { isActive: true }
                    }
                }
            });

            if (!postAuthor) return;

            // Check notification settings
            const settings = postAuthor.notificationSettings;
            if (settings && !settings.enableLikeNotifications) {
                return;
            }

            // Check quiet hours
            if (this.isQuietHours(settings)) {
                return;
            }

            // Create notification
            const notification = await prisma.notification.create({
                data: {
                    senderId: like.userId,
                    receiverId: post.authorId,
                    title: 'New Like',
                    body: `${liker.firstName} liked your post`,
                    type: 'NEW_LIKE',
                    postId: post.id
                }
            });

            // Send push notification
            const pushMessages = [];
            for (const pushToken of postAuthor.pushTokens) {
                if (Expo.isExpoPushToken(pushToken.token)) {
                    pushMessages.push({
                        to: pushToken.token,
                        sound: 'default',
                        title: 'New Like',
                        body: `${liker.firstName} liked your post`,
                        data: {
                            type: 'NEW_LIKE',
                            postId: post.id,
                            notificationId: notification.id
                        },
                        badge: await this.calculateTotalBadgeCount(postAuthor.id)
                    });
                }
            }

            if (pushMessages.length > 0) {
                await this.sendPushNotifications(pushMessages, [notification]);
            }

            console.log(`Sent like notification to post author ${post.authorId}`);
            return notification;

        } catch (error) {
            console.error('Error sending like notification:', error);
            throw error;
        }
    }

    /**
     * Calculate total badge count for a user (unread posts + unread messages)
     * @param {number} userId 
     * @returns {number} Total badge count
     */
    static async calculateTotalBadgeCount(userId) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    unreadPostsCount: true,
                    unreadMessagesCount: true
                }
            });

            if (!user) return 0;

            return (user.unreadPostsCount || 0) + (user.unreadMessagesCount || 0);

        } catch (error) {
            console.error('Error calculating badge count:', error);
            return 0;
        }
    }

    /**
     * Check if current time is in user's quiet hours
     * @param {Object} settings - User's notification settings
     * @returns {boolean} True if in quiet hours
     */
    static isQuietHours(settings) {
        if (!settings || !settings.quietHoursStart || !settings.quietHoursEnd) {
            return false; // No quiet hours set
        }

        try {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const currentTime = currentHour * 60 + currentMinute; // Convert to minutes

            const [startHour, startMinute] = settings.quietHoursStart.split(':').map(Number);
            const [endHour, endMinute] = settings.quietHoursEnd.split(':').map(Number);

            const startTime = startHour * 60 + startMinute;
            const endTime = endHour * 60 + endMinute;

            // Handle quiet hours that span midnight
            if (startTime > endTime) {
                return currentTime >= startTime || currentTime <= endTime;
            } else {
                return currentTime >= startTime && currentTime <= endTime;
            }

        } catch (error) {
            console.error('Error checking quiet hours:', error);
            return false;
        }
    }

    /**
     * Send push notifications in batches
     * @param {Array} messages - Array of push notification messages
     * @param {Array} notifications - Array of notification records
     */
static async sendPushNotifications(messages, notifications) {
    try {
        // 🔥 DEBUG: Log the exact payload being sent
        console.log('🚀 DEBUGGING PUSH NOTIFICATION PAYLOAD:');
        console.log('📱 Number of messages to send:', messages.length);
        
        messages.forEach((message, index) => {
            console.log(`📨 Message ${index + 1}:`, JSON.stringify(message, null, 2));
        });

        const chunks = expo.chunkPushNotifications(messages);
        const tickets = [];

        // Send notifications in chunks
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            console.log(`📦 Sending chunk ${i + 1}/${chunks.length} with ${chunk.length} notifications`);
            
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
                
                // 🔥 DEBUG: Log the response from Expo
                console.log(`✅ Chunk ${i + 1} response:`, JSON.stringify(ticketChunk, null, 2));
            } catch (error) {
                console.error(`❌ Error sending chunk ${i + 1}:`, error);
            }
        }

        // 🔥 DEBUG: Detailed ticket analysis
        console.log('🎫 TICKET ANALYSIS:');
        tickets.forEach((ticket, index) => {
            if (ticket.status === 'error') {
                console.log(`❌ Ticket ${index + 1} ERROR:`, ticket.message, ticket.details);
            } else {
                console.log(`✅ Ticket ${index + 1} SUCCESS:`, ticket.id);
            }
        });

        // Update notification records with push status
        for (let i = 0; i < notifications.length && i < tickets.length; i++) {
            const ticket = tickets[i];
            const notification = notifications[i];

            try {
                await prisma.notification.update({
                    where: { id: notification.id },
                    data: {
                        pushSent: ticket.status === 'ok',
                        pushSentAt: new Date(),
                        pushError: ticket.status === 'error' ? `${ticket.message}: ${JSON.stringify(ticket.details)}` : null
                    }
                });
            } catch (error) {
                console.error('Error updating notification push status:', error);
            }
        }

        console.log(`📊 SUMMARY: Sent ${tickets.length} push notifications`);
        console.log(`✅ Successful: ${tickets.filter(t => t.status === 'ok').length}`);
        console.log(`❌ Failed: ${tickets.filter(t => t.status === 'error').length}`);
        
        return tickets;

    } catch (error) {
        console.error('❌ CRITICAL ERROR in sendPushNotifications:', error);
        throw error;
    }
}
}

module.exports = NotificationService;