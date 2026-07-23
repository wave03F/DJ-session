const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { createError } = require('../middleware/errorHandler');

/**
 * Get full profile for a user (with photos and genres)
 */
async function getProfile(userId) {
  const profile = await db('profiles').where({ user_id: userId }).first();
  if (!profile) {
    throw createError('Profile not found', 404);
  }

  const photos = await db('profile_photos')
    .where({ profile_id: profile.id })
    .orderBy('position', 'asc');

  const genres = await db('user_genres')
    .where({ user_id: userId })
    .pluck('genre');

  const user = await db('users')
    .where({ id: userId })
    .select('email', 'nickname', 'date_of_birth', 'is_premium', 'created_at')
    .first();

  return {
    ...profile,
    photos,
    genres,
    email: user.email,
    nickname: user.nickname,
    age: calculateAge(new Date(user.date_of_birth)),
    is_premium: user.is_premium,
    member_since: user.created_at
  };
}

/**
 * Update profile fields
 */
async function updateProfile(userId, data) {
  const allowedFields = ['display_name', 'bio', 'gender'];
  const updates = {};

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates[field] = data[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    throw createError('No valid fields to update', 400);
  }

  // Validate bio length
  if (updates.bio && updates.bio.length > 500) {
    throw createError('Bio must be 500 characters or less', 400);
  }

  // Validate display_name
  if (updates.display_name && updates.display_name.trim().length === 0) {
    throw createError('Display name cannot be empty', 400);
  }

  updates.updated_at = new Date();

  await db('profiles').where({ user_id: userId }).update(updates);

  return getProfile(userId);
}

/**
 * Update music genre preferences
 */
async function updateGenres(userId, genres) {
  if (!Array.isArray(genres) || genres.length === 0) {
    throw createError('At least one genre is required', 400);
  }

  const validGenres = [
    'pop', 'rock', 'hiphop', 'rnb', 'jazz', 'classical', 'electronic',
    'country', 'indie', 'metal', 'reggae', 'blues', 'folk', 'punk',
    'kpop', 'jpop', 'thai', 'latin', 'soul', 'ambient'
  ];

  const filtered = genres.filter(g => validGenres.includes(g.toLowerCase()));
  if (filtered.length === 0) {
    throw createError('No valid genres provided', 400);
  }

  // Replace all genres
  await db('user_genres').where({ user_id: userId }).del();
  await db('user_genres').insert(
    filtered.map(genre => ({ id: uuidv4(), user_id: userId, genre: genre.toLowerCase() }))
  );

  return filtered;
}

/**
 * Update discovery preferences
 */
async function updateDiscoveryPreferences(userId, prefs) {
  const updates = {};

  if (prefs.ageMin !== undefined) {
    updates.discovery_age_min = Math.max(18, Math.min(100, parseInt(prefs.ageMin)));
  }
  if (prefs.ageMax !== undefined) {
    updates.discovery_age_max = Math.max(18, Math.min(100, parseInt(prefs.ageMax)));
  }
  if (prefs.genderPreference !== undefined) {
    const valid = ['male', 'female', 'non-binary', 'any'];
    updates.discovery_gender = valid.includes(prefs.genderPreference) ? prefs.genderPreference : 'any';
  }
  if (prefs.genreThreshold !== undefined) {
    updates.discovery_genre_threshold = Math.max(1, Math.min(10, parseInt(prefs.genreThreshold)));
  }

  if (Object.keys(updates).length === 0) {
    throw createError('No valid preferences to update', 400);
  }

  updates.updated_at = new Date();
  await db('profiles').where({ user_id: userId }).update(updates);

  return updates;
}

/**
 * Add a photo to profile
 */
async function addPhoto(userId, photoUrl) {
  const profile = await db('profiles').where({ user_id: userId }).first();
  if (!profile) throw createError('Profile not found', 404);

  const photoCount = await db('profile_photos').where({ profile_id: profile.id }).count('* as count').first();
  if (parseInt(photoCount.count) >= 6) {
    throw createError('Maximum 6 photos allowed', 400);
  }

  const nextPosition = parseInt(photoCount.count) + 1;

  const [photo] = await db('profile_photos')
    .insert({
      id: uuidv4(),
      profile_id: profile.id,
      url: photoUrl,
      position: nextPosition,
      is_verified: false,
      created_at: new Date()
    })
    .returning('*');

  // Check if profile can be marked active (has display_name + 1 photo + bio)
  if (profile.display_name && profile.bio && nextPosition >= 1) {
    await db('profiles').where({ id: profile.id }).update({ is_active: true });
  }

  return photo;
}

/**
 * Delete a photo from profile
 */
async function deletePhoto(userId, photoId) {
  const profile = await db('profiles').where({ user_id: userId }).first();
  if (!profile) throw createError('Profile not found', 404);

  const photo = await db('profile_photos')
    .where({ id: photoId, profile_id: profile.id })
    .first();

  if (!photo) throw createError('Photo not found', 404);

  await db('profile_photos').where({ id: photoId }).del();

  // Reorder positions
  const remaining = await db('profile_photos')
    .where({ profile_id: profile.id })
    .orderBy('position', 'asc');

  for (let i = 0; i < remaining.length; i++) {
    await db('profile_photos').where({ id: remaining[i].id }).update({ position: i + 1 });
  }

  // Check if profile should be deactivated (no photos)
  if (remaining.length === 0) {
    await db('profiles').where({ id: profile.id }).update({ is_active: false });
  }

  return { deleted: true };
}

function calculateAge(dob) {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

module.exports = {
  getProfile,
  updateProfile,
  updateGenres,
  updateDiscoveryPreferences,
  addPhoto,
  deletePhoto
};
