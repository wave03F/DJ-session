const { Router } = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const profileService = require('../services/profileService');
const cloudinary = require('../config/cloudinary');

const router = Router();

// Multer config for file upload (memory storage, max 5MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG images are allowed'));
    }
  }
});

/**
 * GET /api/profiles/me
 * Get own profile
 */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const profile = await profileService.getProfile(req.user.id);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/profiles/me
 * Update profile fields (display_name, bio, gender)
 */
router.put('/me', requireAuth, [
  body('display_name').optional().trim().isLength({ min: 1, max: 100 }),
  body('bio').optional().isLength({ max: 500 }),
  body('gender').optional().isIn(['male', 'female', 'non-binary']),
  validate
], async (req, res, next) => {
  try {
    const profile = await profileService.updateProfile(req.user.id, req.body);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/profiles/me/genres
 * Update music genre preferences
 */
router.put('/me/genres', requireAuth, [
  body('genres').isArray({ min: 1 }).withMessage('At least one genre required'),
  validate
], async (req, res, next) => {
  try {
    const genres = await profileService.updateGenres(req.user.id, req.body.genres);
    res.json({ genres });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/profiles/me/preferences
 * Update discovery preferences
 */
router.put('/me/preferences', requireAuth, async (req, res, next) => {
  try {
    const prefs = await profileService.updateDiscoveryPreferences(req.user.id, req.body);
    res.json(prefs);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/profiles/me/photos
 * Upload a profile photo (Cloudinary)
 */
router.post('/me/photos', requireAuth, upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Photo file required' });
    }

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'pixel-music-world/profiles',
          transformation: [
            { width: 800, height: 800, crop: 'limit' },
            { quality: 'auto', fetch_format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    const photo = await profileService.addPhoto(req.user.id, result.secure_url);
    res.status(201).json(photo);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/profiles/me/photos/:id
 * Delete a profile photo
 */
router.delete('/me/photos/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await profileService.deletePhoto(req.user.id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
