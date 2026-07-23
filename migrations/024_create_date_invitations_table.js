/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('date_invitations', (table) => {
    table.uuid('id').primary();
    table.uuid('inviter_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.uuid('invitee_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('theme', 30).notNullable(); // rooftop, beach, cafe, music_garden
    table.string('status', 20).defaultTo('pending'); // pending, accepted, rejected, expired
    table.timestamp('proposed_time');
    table.timestamp('responded_at');
    table.timestamp('expires_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['inviter_id', 'status']);
    table.index(['invitee_id', 'status']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('date_invitations');
};
