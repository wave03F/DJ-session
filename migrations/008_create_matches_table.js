/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('matches', (table) => {
    table.uuid('id').primary();
    table.uuid('user1_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.uuid('user2_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('matched_at').defaultTo(knex.fn.now());

    table.unique(['user1_id', 'user2_id']);
    table.index(['user1_id', 'is_active']);
    table.index(['user2_id', 'is_active']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('matches');
};
