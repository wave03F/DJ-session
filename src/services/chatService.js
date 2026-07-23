const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { createError } = require('../middleware/errorHandler');

// Banned words filter (basic — expand later)
const BANNED_WORDS = ['spam', 'scam'];

/**
 * Get all conversations for a user
 */
async function getConversations(userId) {
  const convos = await db('conversations')
    .where({ is_active: true })
    .andWhere(function() {
      this.where({ user1_id: userId }).orWhere({ user2_id: userId });
    })
    .orderBy('last_message_at', 'desc');

  const result = [];
  for (const convo of convos) {
    const partnerId = convo.user1_id === userId ? convo.user2_id : convo.user1_id;
    const partner = await db('users')
      .join('profiles', 'users.id', 'profiles.user_id')
      .where('users.id', partnerId)
      .select('users.id', 'profiles.display_name')
      .first();

    // Get last message preview
    const lastMsg = await db('messages')
      .where({ conversation_id: convo.id })
      .orderBy('created_at', 'desc')
      .first();

    // Count unread messages
    const unread = await db('messages')
      .where({ conversation_id: convo.id })
      .whereNot({ sender_id: userId })
      .whereNot({ status: 'read' })
      .count('* as count')
      .first();

    result.push({
      id: convo.id,
      matchId: convo.match_id,
      partner: partner || { id: partnerId, display_name: 'User' },
      lastMessage: lastMsg ? { content: lastMsg.content.substring(0, 50), createdAt: lastMsg.created_at, senderId: lastMsg.sender_id } : null,
      unreadCount: parseInt(unread.count),
      lastMessageAt: convo.last_message_at
    });
  }

  return result;
}

/**
 * Get messages in a conversation (paginated)
 */
async function getMessages(userId, conversationId, { limit = 50, before } = {}) {
  // Verify user belongs to this conversation
  const convo = await db('conversations')
    .where({ id: conversationId, is_active: true })
    .andWhere(function() {
      this.where({ user1_id: userId }).orWhere({ user2_id: userId });
    })
    .first();

  if (!convo) throw createError('Conversation not found', 404);

  let query = db('messages')
    .where({ conversation_id: conversationId })
    .orderBy('created_at', 'desc')
    .limit(limit);

  if (before) {
    query = query.where('created_at', '<', before);
  }

  const messages = await query;

  // Mark messages from partner as read
  const partnerId = convo.user1_id === userId ? convo.user2_id : convo.user1_id;
  await db('messages')
    .where({ conversation_id: conversationId, sender_id: partnerId })
    .whereNot({ status: 'read' })
    .update({ status: 'read' });

  return messages.reverse(); // oldest first
}

/**
 * Send a DM message
 */
async function sendMessage(senderId, conversationId, content) {
  if (!content || content.trim().length === 0) {
    throw createError('Message cannot be empty', 400);
  }
  if (content.length > 500) {
    throw createError('Message too long (max 500 characters)', 400);
  }

  // Check banned words
  const lowerContent = content.toLowerCase();
  for (const word of BANNED_WORDS) {
    if (lowerContent.includes(word)) {
      throw createError('Message contains prohibited content', 400);
    }
  }

  // Verify sender belongs to conversation
  const convo = await db('conversations')
    .where({ id: conversationId, is_active: true })
    .andWhere(function() {
      this.where({ user1_id: senderId }).orWhere({ user2_id: senderId });
    })
    .first();

  if (!convo) throw createError('Conversation not found or not a member', 403);

  // Check if blocked
  const partnerId = convo.user1_id === senderId ? convo.user2_id : convo.user1_id;
  const blocked = await db('blocks')
    .where(function() {
      this.where({ blocker_id: senderId, blocked_id: partnerId })
        .orWhere({ blocker_id: partnerId, blocked_id: senderId });
    })
    .first();

  if (blocked) throw createError('Cannot send message to this user', 403);

  // Insert message
  const message = {
    id: uuidv4(),
    conversation_id: conversationId,
    sender_id: senderId,
    content: content.trim(),
    status: 'sent',
    created_at: new Date()
  };

  await db('messages').insert(message);

  // Update conversation last_message_at
  await db('conversations').where({ id: conversationId }).update({ last_message_at: new Date() });

  // Create notification for recipient
  await db('notifications').insert({
    id: uuidv4(),
    user_id: partnerId,
    type: 'message',
    data: JSON.stringify({ conversationId, senderId, preview: content.substring(0, 50) }),
    created_at: new Date()
  });

  return { ...message, partnerId };
}

/**
 * Update message delivery status
 */
async function updateMessageStatus(userId, messageId, status) {
  const validStatuses = ['delivered', 'read'];
  if (!validStatuses.includes(status)) {
    throw createError('Invalid status', 400);
  }

  // Only the recipient can update status
  const message = await db('messages').where({ id: messageId }).first();
  if (!message) throw createError('Message not found', 404);

  // Verify user is the recipient (not sender)
  if (message.sender_id === userId) {
    throw createError('Cannot update status of own message', 400);
  }

  await db('messages').where({ id: messageId }).update({ status });
  return { updated: true };
}

module.exports = {
  getConversations,
  getMessages,
  sendMessage,
  updateMessageStatus
};
