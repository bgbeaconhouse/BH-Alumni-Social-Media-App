const express = require("express");
const router = express.Router();
const multer = require("multer");
const prisma = require("../prisma");
const verifyToken = require("../verify");
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp'); // Add Sharp for image optimization
const ffmpeg = require('fluent-ffmpeg');

// NEW: Import notification service
const NotificationService = require("../services/notificationService");

// Configure Multer for disk storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
       const uploadPath = '/mnt/disks/uploads/';
        // Create the directory if it doesn't exist
        fs.mkdir(uploadPath, { recursive: true }).then(() => {
            // Also create optimized directory for future use
            return fs.mkdir('/mnt/disks/uploads/optimized/', { recursive: true });
        }).then(() => {
            cb(null, uploadPath);
        }).catch(err => cb(err));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + fileExtension);
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
}).array('media', 10);

router.post("/", verifyToken, upload, async (req, res, next) => {
    // 🔥 DEBUG LOGGING - Add extensive logging to see what's happening
    console.log('🆕🆕🆕 POST /api/posts route HIT!');
    console.log('🆕 User ID:', req.userId);
    console.log('🆕 Content:', req.body.content);
    console.log('🆕 Files:', req.files ? req.files.length : 0);
    console.log('🆕 Request came from IP:', req.ip);
    console.log('🆕 Request headers:', req.headers);
    
    try {
        const { content } = req.body;
        const files = req.files;
        const userId = req.userId;

        console.log("🆕 Request body:", req.body);
        console.log("🆕 Uploaded files:", files);

        if (!content && (!files || files.length === 0)) {
            console.log('🆕 ERROR: Post must have either content or media');
            return res.status(400).json({ error: "Post must have either content or media." });
        }

        console.log('🆕 Creating post in database...');
        const post = await prisma.post.create({
            data: {
                content: content,
                authorId: userId,
            },
        });
        console.log('🆕 POST CREATED IN DATABASE:', post.id);

        if (files && files.length > 0) {
            console.log('🆕 Processing files...');
            const imageAttachments = [];
            const videoAttachments = [];

            for (const file of files) {
                const fileExtension = path.extname(file.originalname).toLowerCase();
                
                if (['.jpg', '.jpeg', '.png', '.gif'].includes(fileExtension)) {
                    // Create optimized versions but don't save to database yet
                    try {
                        const optimizedFilename = `optimized-${file.filename}`;
                        const optimizedFilePath = path.join('/mnt/disks/uploads/optimized/', optimizedFilename);
                        
                        // Create optimized image with Sharp
                        await sharp(file.path)
                            .resize({ 
                                width: 800, 
                                height: 800, 
                                fit: 'inside',
                                withoutEnlargement: true 
                            })
                            .jpeg({ 
                                quality: 80,
                                progressive: true
                            })
                            .toFile(optimizedFilePath);

                        // Create thumbnail (200x200) for faster loading
                        const thumbnailFilename = `thumb-${file.filename}`;
                        const thumbnailFilePath = path.join('/mnt/disks/uploads/optimized/', thumbnailFilename);
                        
                        await sharp(file.path)
                            .resize(200, 200, { 
                                fit: 'cover',
                                position: 'center' 
                            })
                            .jpeg({ 
                                quality: 70,
                                progressive: true
                            })
                            .toFile(thumbnailFilePath);

                        console.log(`🆕 Created optimized versions for ${file.filename}`);
                    } catch (optimizationError) {
                        console.error("🆕 Image optimization failed:", optimizationError);
                    }

                    // Save to database with current schema (only original URL)
                    imageAttachments.push({ 
                        postId: post.id, 
                        url: file.filename
                    });
              } else if (['.mp4', '.mpeg', '.mov'].includes(fileExtension)) {
    let thumbnailFilename = null;
    try {
        thumbnailFilename = `thumb-${file.filename}.jpg`;
        await new Promise((resolve, reject) => {
            ffmpeg(file.path)
                .screenshots({
                    timestamps: ['00:00:01'],
                    filename: thumbnailFilename,
                    folder: '/mnt/disks/uploads/optimized/',
                    size: '480x?'
                })
                .on('end', resolve)
                .on('error', reject);
        });
        console.log('🆕 Video thumbnail created:', thumbnailFilename);
    } catch (thumbError) {
        console.error('🆕 Thumbnail generation failed:', thumbError);
        thumbnailFilename = null;
    }
    videoAttachments.push({ 
        postId: post.id, 
        url: file.filename,
        thumbnailUrl: thumbnailFilename ? `optimized/${thumbnailFilename}` : null
    });
}
            }

            if (imageAttachments.length > 0) {
                console.log('🆕 Saving image attachments to database...');
                await prisma.postImageAttachment.createMany({
                    data: imageAttachments,
                });
            }

            if (videoAttachments.length > 0) {
                console.log('🆕 Saving video attachments to database...');
                await prisma.postVideoAttachment.createMany({
                    data: videoAttachments,
                });
            }
        }

        console.log('🆕 Fetching populated post...');
        const populatedPost = await prisma.post.findUnique({
            where: { id: post.id },
            include: {
                author: true,
                imageAttachments: true,
                videoAttachments: true,
            },
        });
        console.log('🆕 Populated post fetched:', {
            id: populatedPost.id,
            authorId: populatedPost.authorId,
            authorName: `${populatedPost.author.firstName} ${populatedPost.author.lastName}`
        });

        // 🔥 CRITICAL: Send notifications to all users about the new post
        console.log('🆕 About to send notifications for post:', post.id);
        console.log('🆕 NotificationService available:', typeof NotificationService);
        console.log('🆕 sendNewPostNotification method available:', typeof NotificationService.sendNewPostNotification);
        
        try {
            console.log('🆕 Calling NotificationService.sendNewPostNotification...');
            await NotificationService.sendNewPostNotification(populatedPost, populatedPost.author);
            console.log('🆕 New post notifications sent successfully');
        } catch (notificationError) {
            console.error('🆕 ERROR sending post notification:', notificationError);
            console.error('🆕 Notification error stack:', notificationError.stack);
            // Don't fail the post creation if notifications fail
        }

        console.log('🆕 Responding with created post');
        res.status(201).json(populatedPost);

    } catch (error) {
        console.error("🆕 ERROR creating post:", error);
        console.error("🆕 Error stack:", error.stack);
        next(error);
    }
});

// GET request to view all posts with pagination
router.get("/", async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

       const userId = req.query.userId ? parseInt(req.query.userId) : undefined;

const posts = await prisma.post.findMany({
    skip,
    take: limit,
    where: userId ? { authorId: userId } : undefined,
    include: {
                author: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        username: true,
                    },
                },
                likes: true,
                comments: {
                    take: 3, // Only load first 3 comments initially
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                firstName: true,
                                lastName: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                },
                imageAttachments: true,
                videoAttachments: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        // Get total count for pagination info
        const totalPosts = await prisma.post.count();
        const hasMore = skip + posts.length < totalPosts;

        res.status(200).json({
            posts,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalPosts / limit),
                hasMore,
                totalPosts
            }
        });
    } catch (error) {
        console.error("Error fetching all posts:", error);
        next(error);
    }
});

// GET comments for a specific post with pagination
router.get("/:postId/comments", async (req, res, next) => {
    const { postId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    try {
        const comments = await prisma.comment.findMany({
            where: { postId: parseInt(postId) },
            skip,
            take: limit,
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        const totalComments = await prisma.comment.count({
            where: { postId: parseInt(postId) }
        });

        res.status(200).json({
            comments,
            pagination: {
                currentPage: page,
                hasMore: skip + comments.length < totalComments,
                totalComments
            }
        });
    } catch (error) {
        console.error("Error fetching comments:", error);
        next(error);
    }
});

// POST a new comment to a post
router.post("/:postId/comments", verifyToken, async (req, res, next) => {
    console.log("Request Body (comment):", req.body); 
    const { postId } = req.params;
    const { content } = req.body;
    const userId = req.userId;

    if (!content) {
        return res.status(400).json({ error: "Comment content cannot be empty." });
    }

    try {
        const newComment = await prisma.comment.create({
            data: {
                content: content,
                postId: parseInt(postId),
                userId: userId,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        // NEW: Send notification to post author about the new comment
        try {
            console.log('Sending new comment notification...');
            
            // Get the post and commenter info
            const post = await prisma.post.findUnique({
                where: { id: parseInt(postId) },
                include: { author: true }
            });

            const commenter = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, firstName: true, lastName: true }
            });

            if (post && commenter) {
                await NotificationService.sendNewCommentNotification(newComment, commenter, post);
                console.log('New comment notification sent successfully');
            }
        } catch (notificationError) {
            console.error('Error sending comment notification:', notificationError);
            // Don't fail the comment creation if notifications fail
        }

        res.status(201).json(newComment);
    } catch (error) {
        console.error("Error creating comment:", error);
        next(error);
    }
});

// GET likes for a specific post
router.get("/:postId/likes", async (req, res, next) => {
    const { postId } = req.params;
    try {
        const likes = await prisma.like.findMany({
            where: { postId: parseInt(postId) },
        });
        res.status(200).json(likes);
    } catch (error) {
        console.error("Error fetching likes:", error);
        next(error);
    }
});

// GET user like status for a specific post
router.get("/:postId/userLike", verifyToken, async (req, res, next) => {
    const { postId } = req.params;
    const userId = req.userId;
    try {
        const like = await prisma.like.findFirst({
            where: {
                postId: parseInt(postId),
                userId: userId,
            },
        });
        res.status(200).json({ liked: !!like });
    } catch (error) {
        console.error("Error fetching user like status:", error);
        next(error);
    }
});

// POST endpoint to like or unlike a post
router.post("/:postId/like", verifyToken, async (req, res, next) => {
    const { postId } = req.params;
    const userId = req.userId;

    try {
        const existingLike = await prisma.like.findFirst({
            where: {
                postId: parseInt(postId),
                userId: userId,
            },
        });

        if (existingLike) {
            await prisma.like.delete({
                where: {
                    id: existingLike.id,
                },
            });
            const updatedLikes = await prisma.like.findMany({
                where: { postId: parseInt(postId) },
            });
            res.status(200).json({ message: "Post unliked", liked: false, likes: updatedLikes });
        } else {
            // Create the new like
            const newLike = await prisma.like.create({
                data: {
                    postId: parseInt(postId),
                    userId: userId,
                },
            });

            // NEW: Send notification to post author about the new like
            try {
                console.log('Sending new like notification...');
                
                // Get the post and liker info
                const post = await prisma.post.findUnique({
                    where: { id: parseInt(postId) },
                    include: { author: true }
                });

                const liker = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { id: true, firstName: true, lastName: true }
                });

                if (post && liker) {
                    await NotificationService.sendNewLikeNotification(newLike, liker, post);
                    console.log('New like notification sent successfully');
                }
            } catch (notificationError) {
                console.error('Error sending like notification:', notificationError);
                // Don't fail the like creation if notifications fail
            }

            const updatedLikes = await prisma.like.findMany({
                where: { postId: parseInt(postId) },
            });
            res.status(200).json({ message: "Post liked", liked: true, likes: updatedLikes });
        }
    } catch (error) {
        console.error("Error liking/unliking post:", error);
        next(error);
    }
});

// DELETE endpoint to delete a comment
router.delete("/comments/:commentId", verifyToken, async (req, res, next) => {
    const { commentId } = req.params;
    const userId = req.userId;

    try {
        const comment = await prisma.comment.findUnique({
            where: { id: parseInt(commentId) },
        });

        if (!comment) {
            return res.status(404).json({ error: "Comment not found." });
        }

        if (comment.userId !== userId) {
            return res.status(403).json({ error: "You are not authorized to delete this comment." });
        }

        await prisma.comment.delete({
            where: { id: parseInt(commentId) },
        });

        res.status(200).json({ message: "Comment deleted successfully." });
    } catch (error) {
        console.error("Error deleting comment:", error);
        next(error);
    }
});

// DELETE endpoint to delete a post
router.delete("/:postId", verifyToken, async (req, res, next) => {
    const { postId } = req.params;
    const userId = req.userId;

    try {
        const post = await prisma.post.findUnique({
            where: { id: parseInt(postId) },
            include: {
                imageAttachments: true,
                videoAttachments: true,
            },
        });

        if (!post) {
            return res.status(404).json({ error: "Post not found." });
        }

        if (post.authorId !== userId) {
            return res.status(403).json({ error: "You are not authorized to delete this post." });
        }

        // Delete associated media files (including optimized versions)
        const uploadDir = '/mnt/disks/uploads';
        const optimizedDir = '/mnt/disks/uploads/optimized';
        
        if (post.imageAttachments) {
            for (const attachment of post.imageAttachments) {
                const filesToDelete = [
                    path.join(uploadDir, attachment.url), // Original
                    path.join(optimizedDir, `optimized-${attachment.url}`), // Optimized
                    path.join(optimizedDir, `thumb-${attachment.url}`) // Thumbnail
                ];

                for (const filePath of filesToDelete) {
                    try {
                        await fs.unlink(filePath);
                        console.log(`Deleted file: ${filePath}`);
                    } catch (fileError) {
                        console.error(`Error deleting file ${filePath}:`, fileError);
                    }
                }
            }
        }

        if (post.videoAttachments) {
            for (const attachment of post.videoAttachments) {
                const filePath = path.join(uploadDir, attachment.url);
                try {
                    await fs.unlink(filePath);
                    console.log(`Deleted file: ${filePath}`);
                } catch (fileError) {
                    console.error(`Error deleting file ${filePath}:`, fileError);
                }
            }
        }

        await prisma.post.delete({
            where: { id: parseInt(postId) },
        });

        res.status(200).json({ message: "Post deleted successfully." });

    } catch (error) {
        console.error("Error deleting post:", error);
        next(error);
    }
});

module.exports = router;