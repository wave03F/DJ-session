/**
 * Phase 7: Performance indexes on high-traffic columns
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema
    // Users - quick lookup by suspended status
    .table('users', (table) => {
      table.index(['is_suspended', 'created_at']);
    })
    // Likes - for checking mutual likes
    .table('likes', (table) => {
      table.index(['liked_id', 'liker_id']);
    })
    // Messages - for unread counts
    .table('messages', (table) => {
      table.index(['conversation_id', 'status']);
    })
    // Music queue - active room queue lookups
    .table('music_queue', (table) => {
      table.index(['room_id', 'is_playing', 'is_played', 'upvotes']);
    })
    // Notifications - unread for user
    .table('notifications', (table) => {
      table.index(['user_id', 'is_read']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .table('users', t => t.dropIndex(['is_suspended', 'created_at']))
    .table('likes', t => t.dropIndex(['liked_id', 'liker_id']))
    .table('messages', t => t.dropIndex(['conversation_id', 'status']))
    .table('music_queue', t => t.dropIndex(['room_id', 'is_playing', 'is_played', 'upvotes']))
    .table('notifications', t => t.dropIndex(['user_id', 'is_read']));
};
