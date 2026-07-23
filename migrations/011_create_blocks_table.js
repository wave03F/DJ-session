/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('blocks', (table) => {
    table.uuid('id').primary();
    table.uuid('blocker_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.uuid('blocked_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['blocker_id', 'blocked_id']);
    table.index(['blocked_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('blocks');
};
