/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('likes', (table) => {
    table.uuid('id').primary();
    table.uuid('liker_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.uuid('liked_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['liker_id', 'liked_id']);
    table.index(['liked_id']);
    table.index(['liker_id', 'created_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('likes');
};
