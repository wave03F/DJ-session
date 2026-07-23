const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { createError } = require('../middleware/errorHandler');

const VALID_THEMES = ['rooftop', 'beach', 'cafe', 'music_garden'];
const FREE_DAILY_INVITES = 3;

// ─── RELATIONSHIP STATUS ─────────────────────────────────────────────────────

/**
 * Request to become a couple (must be matched first)
 */
async function requestRelationship(requesterId, targetId) {
  if (requesterId === targetId) throw createError('Cannot request relationship with yourself', 400);

  // Verify they are matched
  const match = await db('matches')
    .where({ is_active: true })
    .andWhere(function() {
      this.where({ user1_id: requesterId, user2_id: targetId })
        .orWhere({ user1_id: targetId, user2_id: requesterId });
    })
    .first();

  if (!match) throw createError('You must be matched with this user first', 403);

  // Check neither user is already in a relationship
  const existingRel = await db('relationships')
    .where({ status: 'active' })
    .andWhere(function() {
      this.where({ user1_id: requesterId })
        .orWhere({ user2_id: requesterId })
        .orWhere({ user1_id: targetId })
        .orWhere({ user2_id: targetId });
    })
    .first();

  if (existingRel) throw createError('One or both users are already in a relationship', 409);

  // Check for pending request
  const pendingReq = await db('relationships')
    .where({ status: 'pending' })
    .andWhere(function() {
      this.where({ user1_id: requesterId, user2_id: targetId })
        .orWhere({ user1_id: targetId, user2_id: requesterId });
    })
    .first();

  if (pendingReq) {
    // If partner already requested, auto-confirm
    if (pendingReq.requested_by === targetId) {
      return confirmRelationship(requesterId, pendingReq.id);
    }
    throw createError('Relationship request already pending', 409);
  }

  // Create pending request
  const [u1, u2] = [requesterId, targetId].sort();
  const relationship = {
    id: uuidv4(),
    user1_id: u1,
    user2_id: u2,
    status: 'pending',
    requested_by: requesterId,
    created_at: new Date()
  };

  await db('relationships').insert(relationship);

  // Notify target
  await db('notifications').insert({
    id: uuidv4(),
    user_id: targetId,
    type: 'relationship_request',
    data: JSON.stringify({ relationshipId: relationship.id, fromUserId: requesterId }),
    created_at: new Date()
  });

  return relationship;
}

/**
 * Confirm a relationship request (both confirm → In a Relationship)
 */
async function confirmRelationship(userId, relationshipId) {
  const rel = await db('relationships')
    .where({ id: relationshipId, status: 'pending' })
    .first();

  if (!rel) throw createError('Relationship request not found', 404);

  // Verify user is the target (not the requester)
  if (rel.requested_by === userId) {
    throw createError('Cannot confirm your own request. Waiting for partner to confirm.', 400);
  }

  // Verify user is part of this relationship
  if (rel.user1_id !== userId && rel.user2_id !== userId) {
    throw createError('Not authorized', 403);
  }

  // Activate relationship
  await db('relationships').where({ id: relationshipId }).update({
    status: 'active',
    confirmed_at: new Date()
  });

  // Update both profiles to "in_relationship"
  await db('profiles').where({ user_id: rel.user1_id }).update({
    relationship_status: 'in_relationship',
    partner_id: rel.user2_id
  });
  await db('profiles').where({ user_id: rel.user2_id }).update({
    relationship_status: 'in_relationship',
    partner_id: rel.user1_id
  });

  // Notify both
  const partnerId = rel.requested_by;
  await db('notifications').insert({
    id: uuidv4(),
    user_id: partnerId,
    type: 'relationship_confirmed',
    data: JSON.stringify({ relationshipId, partnerId: userId }),
    created_at: new Date()
  });

  return { ...rel, status: 'active', confirmed_at: new Date() };
}

/**
 * End a relationship
 */
async function endRelationship(userId) {
  const rel = await db('relationships')
    .where({ status: 'active' })
    .andWhere(function() {
      this.where({ user1_id: userId }).orWhere({ user2_id: userId });
    })
    .first();

  if (!rel) throw createError('No active relationship found', 404);

  const partnerId = rel.user1_id === userId ? rel.user2_id : rel.user1_id;

  // End relationship
  await db('relationships').where({ id: rel.id }).update({
    status: 'ended',
    ended_at: new Date(),
    ended_by: userId
  });

  // Update both profiles back to "single"
  await db('profiles').where({ user_id: userId }).update({
    relationship_status: 'single',
    partner_id: null
  });
  await db('profiles').where({ user_id: partnerId }).update({
    relationship_status: 'single',
    partner_id: null
  });

  // Notify partner
  await db('notifications').insert({
    id: uuidv4(),
    user_id: partnerId,
    type: 'relationship_ended',
    data: JSON.stringify({ endedBy: userId }),
    created_at: new Date()
  });

  return { ended: true, partnerId };
}

/**
 * Get current relationship status
 */
async function getRelationshipStatus(userId) {
  const rel = await db('relationships')
    .where({ status: 'active' })
    .andWhere(function() {
      this.where({ user1_id: userId }).orWhere({ user2_id: userId });
    })
    .first();

  if (!rel) return { status: 'single', relationship: null };

  const partnerId = rel.user1_id === userId ? rel.user2_id : rel.user1_id;
  const partner = await db('users')
    .join('profiles', 'users.id', 'profiles.user_id')
    .where('users.id', partnerId)
    .select('users.id', 'users.nickname', 'profiles.display_name')
    .first();

  return { status: 'in_relationship', relationship: rel, partner };
}

// ─── DATE INVITATIONS ────────────────────────────────────────────────────────

/**
 * Send a date invitation
 */
async function sendDateInvitation(inviterId, inviteeId, { theme, proposedTime }) {
  if (inviterId === inviteeId) throw createError('Cannot invite yourself', 400);

  if (!VALID_THEMES.includes(theme)) {
    throw createError('Invalid theme. Options: ' + VALID_THEMES.join(', '), 400);
  }

  // Verify they are matched
  const match = await db('matches')
    .where({ is_active: true })
    .andWhere(function() {
      this.where({ user1_id: inviterId, user2_id: inviteeId })
        .orWhere({ user1_id: inviteeId, user2_id: inviterId });
    })
    .first();

  if (!match) throw createError('Must be matched to invite for a date', 403);

  // Check daily invite limit (free users)
  const inviter = await db('users').where({ id: inviterId }).first();
  if (!inviter.is_premium) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayInvites = await db('date_invitations')
      .where({ inviter_id: inviterId })
      .where('created_at', '>=', todayStart)
      .count('* as count')
      .first();

    if (parseInt(todayInvites.count) >= FREE_DAILY_INVITES) {
      throw createError(`Daily invite limit reached (${FREE_DAILY_INVITES}). Upgrade to Premium for unlimited.`, 429);
    }
  }

  const invitation = {
    id: uuidv4(),
    inviter_id: inviterId,
    invitee_id: inviteeId,
    theme,
    status: 'pending',
    proposed_time: proposedTime || null,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h expiry
    created_at: new Date()
  };

  await db('date_invitations').insert(invitation);

  // Notify invitee
  await db('notifications').insert({
    id: uuidv4(),
    user_id: inviteeId,
    type: 'date_invitation',
    data: JSON.stringify({ invitationId: invitation.id, fromUserId: inviterId, theme }),
    created_at: new Date()
  });

  return invitation;
}

/**
 * Accept a date invitation → create Date Room
 */
async function acceptDateInvitation(userId, invitationId) {
  const inv = await db('date_invitations')
    .where({ id: invitationId, invitee_id: userId, status: 'pending' })
    .first();

  if (!inv) throw createError('Invitation not found or already responded', 404);

  // Check if expired
  if (new Date(inv.expires_at) < new Date()) {
    await db('date_invitations').where({ id: invitationId }).update({ status: 'expired' });
    throw createError('Invitation has expired', 410);
  }

  // Accept invitation
  await db('date_invitations').where({ id: invitationId }).update({
    status: 'accepted',
    responded_at: new Date()
  });

  // Create date session
  const dateSession = {
    id: uuidv4(),
    invitation_id: invitationId,
    user1_id: inv.inviter_id,
    user2_id: inv.invitee_id,
    theme: inv.theme,
    status: 'active',
    started_at: new Date()
  };

  await db('dates').insert(dateSession);

  // Notify inviter
  await db('notifications').insert({
    id: uuidv4(),
    user_id: inv.inviter_id,
    type: 'date_accepted',
    data: JSON.stringify({ dateId: dateSession.id, theme: inv.theme, partnerId: userId }),
    created_at: new Date()
  });

  return dateSession;
}

/**
 * Reject a date invitation
 */
async function rejectDateInvitation(userId, invitationId) {
  const inv = await db('date_invitations')
    .where({ id: invitationId, invitee_id: userId, status: 'pending' })
    .first();

  if (!inv) throw createError('Invitation not found or already responded', 404);

  await db('date_invitations').where({ id: invitationId }).update({
    status: 'rejected',
    responded_at: new Date()
  });

  return { rejected: true };
}

/**
 * End a date session
 */
async function endDate(userId, dateId) {
  const date = await db('dates')
    .where({ id: dateId, status: 'active' })
    .andWhere(function() {
      this.where({ user1_id: userId }).orWhere({ user2_id: userId });
    })
    .first();

  if (!date) throw createError('Active date not found', 404);

  const duration = Math.round((Date.now() - new Date(date.started_at).getTime()) / 60000);

  await db('dates').where({ id: dateId }).update({
    status: 'completed',
    ended_at: new Date(),
    duration_minutes: duration
  });

  return { ended: true, durationMinutes: duration };
}

/**
 * Rate a completed date (1-5 stars)
 */
async function rateDate(userId, dateId, rating) {
  if (rating < 1 || rating > 5) throw createError('Rating must be 1-5', 400);

  const date = await db('dates')
    .where({ id: dateId, status: 'completed' })
    .andWhere(function() {
      this.where({ user1_id: userId }).orWhere({ user2_id: userId });
    })
    .first();

  if (!date) throw createError('Completed date not found', 404);

  // Check if already rated
  const existing = await db('date_ratings')
    .where({ date_id: dateId, rater_id: userId })
    .first();

  if (existing) throw createError('Already rated this date', 409);

  await db('date_ratings').insert({
    id: uuidv4(),
    date_id: dateId,
    rater_id: userId,
    rating,
    created_at: new Date()
  });

  return { rated: true, rating };
}

/**
 * Get date invitations (sent and received)
 */
async function getInvitations(userId) {
  const sent = await db('date_invitations')
    .where({ inviter_id: userId })
    .orderBy('created_at', 'desc')
    .limit(20);

  const received = await db('date_invitations')
    .where({ invitee_id: userId })
    .orderBy('created_at', 'desc')
    .limit(20);

  return { sent, received };
}

/**
 * Get active date (if any)
 */
async function getActiveDate(userId) {
  const date = await db('dates')
    .where({ status: 'active' })
    .andWhere(function() {
      this.where({ user1_id: userId }).orWhere({ user2_id: userId });
    })
    .first();

  if (!date) return null;

  const partnerId = date.user1_id === userId ? date.user2_id : date.user1_id;
  const partner = await db('users')
    .join('profiles', 'users.id', 'profiles.user_id')
    .where('users.id', partnerId)
    .select('users.id', 'users.nickname', 'profiles.display_name')
    .first();

  const elapsed = Math.round((Date.now() - new Date(date.started_at).getTime()) / 60000);

  return { ...date, partner, elapsedMinutes: elapsed };
}

module.exports = {
  requestRelationship,
  confirmRelationship,
  endRelationship,
  getRelationshipStatus,
  sendDateInvitation,
  acceptDateInvitation,
  rejectDateInvitation,
  endDate,
  rateDate,
  getInvitations,
  getActiveDate
};
