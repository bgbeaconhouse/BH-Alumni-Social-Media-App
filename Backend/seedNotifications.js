require('dotenv').config(); // Load environment variables from .env

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const seedNotificationSettings = async () => {
  try {
    console.log('Starting notification settings seed...');

    // Get all users who don't have notification settings yet
    const usersWithoutSettings = await prisma.user.findMany({
      where: {
        notificationSettings: null
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true
      }
    });

    console.log(`Found ${usersWithoutSettings.length} users without notification settings`);

    if (usersWithoutSettings.length === 0) {
      console.log('All users already have notification settings!');
      return;
    }

    // Create default notification settings for each user
    const defaultSettings = usersWithoutSettings.map(user => ({
      userId: user.id,
      enablePostNotifications: true,
      enableMessageNotifications: true,
      enableCommentNotifications: true,
      enableLikeNotifications: true,
      // quietHoursStart and quietHoursEnd are optional (null by default)
      // timezone is optional (null by default)
    }));

    // Batch create all notification settings
    const result = await prisma.notificationSettings.createMany({
      data: defaultSettings,
      skipDuplicates: true // Skip if somehow a setting already exists
    });

    console.log(`Successfully created ${result.count} notification settings`);

    // Also reset unread counts to 0 for all existing users
    await prisma.user.updateMany({
      data: {
        unreadPostsCount: 0,
        unreadMessagesCount: 0,
        lastPostViewedAt: new Date()
      }
    });

    console.log('Reset unread counts for all users');

    console.log('Notification settings seed completed successfully!');

  } catch (error) {
    console.error('Error seeding notification settings:', error);
    throw error;
  }
};

// Run the seed function
seedNotificationSettings()
  .then(async () => {
    await prisma.$disconnect();
    console.log('Database connection closed');
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });