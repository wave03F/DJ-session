/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('messages', (table) => {
    table.uuid('id').primary();
    table.uuid('conversation_id').notNullable()
      .references('id').inTable('conversations').onDelete('CASCADE');
    table.uuid('sender_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.text('content').notNullable();
    table.string('status', 20).defaultTo('sent'); // sent, delivered, read
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['conversation_id', 'created_at']);
    table.index(['sender_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('messages');
};
