/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('conversations', (table) => {
    table.uuid('id').primary();
    table.uuid('match_id').notNullable()
      .references('id').inTable('matches').onDelete('CASCADE');
    table.uuid('user1_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.uuid('user2_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('last_message_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['match_id']);
    table.index(['user1_id', 'is_active']);
    table.index(['user2_id', 'is_active']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('conversations');
};
