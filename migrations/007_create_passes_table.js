/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('passes', (table) => {
    table.uuid('id').primary();
    table.uuid('passer_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.uuid('passed_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('expires_at').notNullable(); // 30 days from creation
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['passer_id', 'passed_id']);
    table.index(['passer_id', 'expires_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('passes');
};
