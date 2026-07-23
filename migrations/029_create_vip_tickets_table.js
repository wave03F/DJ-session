/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('vip_tickets', (table) => {
    table.uuid('id').primary();
    table.uuid('user_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.uuid('room_id').notNullable()
      .references('id').inTable('rooms').onDelete('CASCADE');
    table.uuid('payment_id').references('id').inTable('payments');
    table.string('status', 20).defaultTo('active'); // active, used, expired
    table.timestamp('expires_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['user_id', 'room_id']);
    table.index(['user_id', 'status']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('vip_tickets');
};
