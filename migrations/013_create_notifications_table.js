/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('notifications', (table) => {
    table.uuid('id').primary();
    table.uuid('user_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('type', 30).notNullable(); // match, message, date_invitation, event_reminder
    table.jsonb('data'); // flexible payload
    table.boolean('is_read').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['user_id', 'is_read', 'created_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('notifications');
};
