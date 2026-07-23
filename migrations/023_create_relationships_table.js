/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('relationships', (table) => {
    table.uuid('id').primary();
    table.uuid('user1_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.uuid('user2_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('status', 20).defaultTo('pending'); // pending, active, ended
    table.uuid('requested_by').notNullable(); // who initiated
    table.timestamp('confirmed_at');
    table.timestamp('ended_at');
    table.uuid('ended_by'); // who ended it
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['user1_id', 'status']);
    table.index(['user2_id', 'status']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('relationships');
};
