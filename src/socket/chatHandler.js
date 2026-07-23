const chatService = require('../services/chatService');

/**
 * Register DM chat socket events
 */
function registerChatEvents(io, socket) {
  /**
   * dm:send — Send a direct message
   * Payload: { conversationId, content }
   */
  socket.on('dm:send', async (data) => {
    try {
      const { conversationId, content } = data;
      if (!conversationId || !content) return;

      const message = await chatService.sendMessage(socket.user.id, conversationId, content);

      // Send to sender (confirmation with status)
      socket.emit('dm:sent', {
        id: message.id,
        conversationId: message.conversation_id,
        content: message.content,
        status: 'sent',
        createdAt: message.created_at
      });

      // Find partner's socket and deliver
      const partnerSocket = findSocketByUserId(io, message.partnerId);
      if (partnerSocket) {
        partnerSocket.emit('dm:receive', {
          id: message.id,
          conversationId: message.conversation_id,
          senderId: socket.user.id,
          senderName: socket.user.nickname,
          content: message.content,
          createdAt: message.created_at
        });

        // Update status to delivered
        await chatService.updateMessageStatus(message.partnerId, message.id, 'delivered');
        socket.emit('dm:status', { messageId: message.id, status: 'delivered' });
      }
    } catch (err) {
      socket.emit('dm:error', { error: err.message });
    }
  });

  /**
   * dm:read — Mark messages as read
   * Payload: { conversationId }
   */
  socket.on('dm:read', async (data) => {
    try {
      const { conversationId, messageId } = data;
      if (messageId) {
        await chatService.updateMessageStatus(socket.user.id, messageId, 'read');

        // Notify sender that message was read
        const msg = await require('../config/database')('messages').where({ id: messageId }).first();
        if (msg) {
          const senderSocket = findSocketByUserId(io, msg.sender_id);
          if (senderSocket) {
            senderSocket.emit('dm:status', { messageId, status: 'read' });
          }
        }
      }
    } catch (err) {
      // Silent fail for read receipts
    }
  });
}

/**
 * Find a socket by user ID (across all connected sockets)
 */
function findSocketByUserId(io, userId) {
  for (const [, s] of io.sockets.sockets) {
    if (s.user && s.user.id === userId) {
      return s;
    }
  }
  return null;
}

module.exports = { registerChatEvents, findSocketByUserId };
