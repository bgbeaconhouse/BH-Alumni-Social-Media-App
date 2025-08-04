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

            const notifications = [];
            const pushMessages = [];

            for (const user of users) {
                // Check if user has post notifications enabled
                const settings = user.notificationSettings;
                if (settings && !settings.enablePostNotifications) {
                    continue; // Skip if post notifications are disabled
                }

                // Check quiet hours
                if (this.isQuietHours(settings)) {
                    continue; // Skip if in quiet hours
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

                // Prepare push notifications for each device token
                for (const pushToken of user.pushTokens) {
                    if (Expo.isExpoPushToken(pushToken.token)) {
                        pushMessages.push({
                            to: pushToken.token,
                            sound: 'default',
                            title: 'New Post',
                            body: `${author.firstName} shared a new post`,
                            data: {
                                type: 'NEW_POST',
                                postId: post.id,
                                notificationId: notification.id
                            },
                            badge: await this.calculateTotalBadgeCount(user.id)
                        });
                    }
                }
            }

            // Send push notifications in batches
            if (pushMessages.length > 0) {
                await this.sendPushNotifications(pushMessages, notifications);
            }

            console.log(`Sent ${notifications.length} new post notifications for post ${post.id}`);
            return notifications;

        } catch (error) {
            console.error('Error sending new post notification:', error);
            throw error;
        }
    }

    /**
     * Send notification when a new message is sent
     * @param {Object} message - The created message object
     * @param {Object} sender - The message sender object
     */
    static async sendNewMessageNotification(message, sender) {
        try {
            console.log(`Sending message notification for message ${message.id} from sender ${sender.id}`);
            
            // Get conversation members except the sender
            const conversationMembers = await prisma.conversationMember.findMany({
                where: {
                    conversationId: message.conversationId,
                    userId: { not: message.senderId } // CRITICAL: Exclude the sender
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

            console.log(`Found ${conversationMembers.length} conversation members (excluding sender)`);

            const notifications = [];
            const pushMessages = [];

            for (const member of conversationMembers) {
                const user = member.user;

                console.log(`Processing notification for user ${user.id} (${user.firstName})`);

                // DOUBLE CHECK: Make sure we're not sending to the sender
                if (user.id === message.senderId) {
                    console.log(`Skipping notification for sender ${user.id}`);
                    continue;
                }

                // Check if user has message notifications enabled
                const settings = user.notificationSettings;
                if (settings && !settings.enableMessageNotifications) {
                    console.log(`Message notifications disabled for user ${user.id}`);
                    continue;
                }

                // Check quiet hours
                if (this.isQuietHours(settings)) {
                    console.log(`User ${user.id} is in quiet hours`);
                    continue;
                }

                // Create notification record
                const notification = await prisma.notification.create({
                    data: {
                        senderId: message.senderId,
                        receiverId: user.id,
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
                    where: { id: user.id },
                    data: {
                        unreadMessagesCount: { increment: 1 }
                    }
                });

                console.log(`Updated unread count for user ${user.id}`);

                // Prepare push notifications
                for (const pushToken of user.pushTokens) {
                    if (Expo.isExpoPushToken(pushToken.token)) {
                        pushMessages.push({
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
                                notificationId: notification.id
                            },
                            badge: await this.calculateTotalBadgeCount(user.id)
                        });
                    }
                }
            }

            // Send push notifications
            if (pushMessages.length > 0) {
                await this.sendPushNotifications(pushMessages, notifications);
                console.log(`Sent ${pushMessages.length} push notifications`);
            }

            console.log(`Sent ${notifications.length} new message notifications for message ${message.id}`);
            return notifications;

        } catch (error) {
            console.error('Error sending new message notification:', error);
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
            const chunks = expo.chunkPushNotifications(messages);
            const tickets = [];

            // Send notifications in chunks
            for (const chunk of chunks) {
                try {
                    const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                    tickets.push(...ticketChunk);
                } catch (error) {
                    console.error('Error sending push notification chunk:', error);
                }
            }

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
                            pushError: ticket.status === 'error' ? ticket.message : null
                        }
                    });
                } catch (error) {
                    console.error('Error updating notification push status:', error);
                }
            }

            console.log(`Sent ${tickets.length} push notifications`);
            return tickets;

        } catch (error) {
            console.error('Error in sendPushNotifications:', error);
            throw error;
        }
    }
}

module.exports = NotificationService;