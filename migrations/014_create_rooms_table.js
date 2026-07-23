/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('rooms', (table) => {
    table.uuid('id').primary();
    table.string('title', 200).notNullable();
    table.text('description');
    table.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.specificType('genre_tags', 'text[]');
    table.integer('max_capacity').defaultTo(100);
    table.boolean('is_scheduled').defaultTo(false);
    table.timestamp('scheduled_at');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('closed_at');
    table.timestamp('last_activity_at').defaultTo(knex.fn.now());
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['is_active', 'scheduled_at']);
    table.index(['created_by']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('rooms');
};
