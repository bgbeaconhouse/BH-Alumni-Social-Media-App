const express = require("express");
const router = express.Router();
const multer = require("multer");
const prisma = require("../prisma");
const verifyToken = require("../verify");
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');

// Configure Multer for disk storage (same as posts)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = '/mnt/disks/uploads/';
        fs.mkdir(uploadPath, { recursive: true }).then(() => {
            return fs.mkdir('/mnt/disks/uploads/optimized/', { recursive: true });
        }).then(() => {
            cb(null, uploadPath);
        }).catch(err => cb(err));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        cb(null, 'story-' + uniqueSuffix + fileExtension);
    }
});

// Filter function to allow only image and video files
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/mpeg', 'video/quicktime'];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(null, false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
}).single('media'); // Single file for stories

// GET - Fetch all active stories (not expired)
router.get("/", verifyToken, async (req, res, next) => {
    try {
        const currentUserId = req.userId;
        const now = new Date();

        console.log('📖 Fetching stories for user:', currentUserId);

        // Get all active, non-expired stories
        const stories = await prisma.story.findMany({
            where: {
                isActive: true,
                expiresAt: {
                    gt: now // Only stories that haven't expired
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        username: true,
                        profilePictureUrl: true
                    }
                },
                views: {
                    where: {
                        viewerId: currentUserId
                    },
                    select: {
                        id: true
                    }
                },
                _count: {
                    select: {
                        views: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Format stories for frontend
        const formattedStories = stories.map(story => ({
            id: story.id,
            userId: story.userId,
            userName: `${story.user.firstName} ${story.user.lastName}`,
            userAvatar: story.user.profilePictureUrl,
            mediaUrl: `/uploads/${story.mediaUrl}`,
            mediaType: story.mediaType.toLowerCase(),
            createdAt: story.createdAt,
            expiresAt: story.expiresAt,
            viewed: story.views.length > 0, // Has current user viewed this story
            viewCount: story._count.views,
            isOwnStory: story.userId === currentUserId
        }));

        console.log(`📖 Returning ${formattedStories.length} active stories`);
        res.status(200).json(formattedStories);

    } catch (error) {
        console.error("Error fetching stories:", error);
        next(error);
    }
});

// POST - Create a new story
router.post("/", verifyToken, upload, async (req, res, next) => {
    console.log('📝 Creating new story...');
    console.log('User ID:', req.userId);
    console.log('File received:', !!req.file);

    try {
        const userId = req.userId;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: "Media file is required for stories." });
        }

        console.log('📁 Processing uploaded file:', file.filename);

        // Determine media type
        const fileExtension = path.extname(file.originalname).toLowerCase();
        let mediaType;
        
        if (['.jpg', '.jpeg', '.png', '.gif'].includes(fileExtension)) {
            mediaType = 'IMAGE';
            
            // Optimize image for stories (vertical format)
            try {
                const optimizedFilename = `optimized-${file.filename}`;
                const optimizedFilePath = path.join('/mnt/disks/uploads/optimized/', optimizedFilename);
                
                // await sharp(file.path)
                //     .resize({ 
                //         width: 1080, 
                //         height: 1920, 
                //         fit: 'inside',
                //         withoutEnlargement: true 
                //     })
                //     .jpeg({ 
                //         quality: 85,
                //         progressive: true
                //     })
                //     .toFile(optimizedFilePath);

                // console.log('🖼️ Image optimized for story format');
            } catch (optimizationError) {
                console.error("Story image optimization failed:", optimizationError);
            }
            
        } else if (['.mp4', '.mpeg', '.mov'].includes(fileExtension)) {
            mediaType = 'VIDEO';
            // TODO: Add video compression if needed
        } else {
            return res.status(400).json({ error: "Unsupported media type for stories." });
        }

        // Set expiration time (24 hours from now)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        // Create story in database
        const story = await prisma.story.create({
            data: {
                userId: userId,
                mediaUrl: file.filename,
                mediaType: mediaType,
                expiresAt: expiresAt,
                isActive: true
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        username: true,
                        profilePictureUrl: true
                    }
                }
            }
        });

        console.log('✅ Story created successfully:', story.id);

        // Format response
        const formattedStory = {
            id: story.id,
            userId: story.userId,
            userName: `${story.user.firstName} ${story.user.lastName}`,
            userAvatar: story.user.profilePictureUrl,
            mediaUrl: `/uploads/${story.mediaUrl}`,
            mediaType: story.mediaType.toLowerCase(),
            createdAt: story.createdAt,
            expiresAt: story.expiresAt,
            viewed: false,
            viewCount: 0,
            isOwnStory: true
        };

        res.status(201).json(formattedStory);

    } catch (error) {
        console.error("Error creating story:", error);
        next(error);
    }
});

// POST - Mark story as viewed
router.post("/:storyId/view", verifyToken, async (req, res, next) => {
    try {
        const { storyId } = req.params;
        const viewerId = req.userId;

        console.log(`👁️ Marking story ${storyId} as viewed by user ${viewerId}`);

        // Check if story exists and is still active
        const story = await prisma.story.findFirst({
            where: {
                id: parseInt(storyId),
                isActive: true,
                expiresAt: {
                    gt: new Date()
                }
            }
        });

        if (!story) {
            return res.status(404).json({ error: "Story not found or expired." });
        }

        // Don't track views for own stories
        if (story.userId === viewerId) {
            return res.status(200).json({ message: "Own story - view not tracked." });
        }

        // Create view record (upsert to handle duplicate views)
        await prisma.storyView.upsert({
            where: {
                storyId_viewerId: {
                    storyId: parseInt(storyId),
                    viewerId: viewerId
                }
            },
            update: {
                // Update timestamp if view already exists
                createdAt: new Date()
            },
            create: {
                storyId: parseInt(storyId),
                viewerId: viewerId
            }
        });

        console.log(`✅ Story view recorded`);
        res.status(200).json({ message: "Story view recorded." });

    } catch (error) {
        console.error("Error recording story view:", error);
        next(error);
    }
});

// DELETE - Delete own story
router.delete("/:storyId", verifyToken, async (req, res, next) => {
    try {
        const { storyId } = req.params;
        const userId = req.userId;

        console.log(`🗑️ Attempting to delete story ${storyId} by user ${userId}`);

        // Find the story and verify ownership
        const story = await prisma.story.findFirst({
            where: {
                id: parseInt(storyId),
                userId: userId // Only allow deletion of own stories
            }
        });

        if (!story) {
            return res.status(404).json({ error: "Story not found or you don't have permission to delete it." });
        }

        // Delete associated media file
        const filePath = path.join('/mnt/disks/uploads/', story.mediaUrl);
        const optimizedPath = path.join('/mnt/disks/uploads/optimized/', `optimized-${story.mediaUrl}`);

        try {
            await fs.unlink(filePath);
            console.log('📁 Original story file deleted');
        } catch (fileError) {
            console.error('Error deleting original story file:', fileError);
        }

        try {
            await fs.unlink(optimizedPath);
            console.log('📁 Optimized story file deleted');
        } catch (fileError) {
            console.error('Error deleting optimized story file:', fileError);
        }

        // Delete story from database (cascade will handle views)
        await prisma.story.delete({
            where: {
                id: parseInt(storyId)
            }
        });

        console.log('✅ Story deleted successfully');
        res.status(200).json({ message: "Story deleted successfully." });

    } catch (error) {
        console.error("Error deleting story:", error);
        next(error);
    }
});

// GET - Get story views (for story owner)
router.get("/:storyId/views", verifyToken, async (req, res, next) => {
    try {
        const { storyId } = req.params;
        const userId = req.userId;

        // Verify story ownership
        const story = await prisma.story.findFirst({
            where: {
                id: parseInt(storyId),
                userId: userId // Only story owner can see views
            }
        });

        if (!story) {
            return res.status(404).json({ error: "Story not found or you don't have permission to view this data." });
        }

        // Get all views for this story
        const views = await prisma.storyView.findMany({
            where: {
                storyId: parseInt(storyId)
            },
            include: {
                viewer: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        username: true,
                        profilePictureUrl: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        const formattedViews = views.map(view => ({
            id: view.id,
            viewedAt: view.createdAt,
            viewer: {
                id: view.viewer.id,
                name: `${view.viewer.firstName} ${view.viewer.lastName}`,
                username: view.viewer.username,
                avatar: view.viewer.profilePictureUrl
            }
        }));

        res.status(200).json({
            storyId: parseInt(storyId),
            totalViews: views.length,
            views: formattedViews
        });

    } catch (error) {
        console.error("Error fetching story views:", error);
        next(error);
    }
});

module.exports = router;