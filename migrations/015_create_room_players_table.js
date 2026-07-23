/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('room_players', (table) => {
    table.uuid('id').primary();
    table.uuid('room_id').notNullable()
      .references('id').inTable('rooms').onDelete('CASCADE');
    table.uuid('user_id')
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('socket_id', 50);
    table.string('nickname', 100).notNullable();
    table.float('x').defaultTo(0);
    table.float('y').defaultTo(0);
    table.string('direction', 10).defaultTo('down');
    table.string('status', 20).defaultTo('active'); // active, disconnected, idle
    table.timestamp('joined_at').defaultTo(knex.fn.now());
    table.timestamp('disconnected_at'); // for grace period tracking

    table.index(['room_id', 'status']);
    table.index(['user_id']);
    table.index(['socket_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('room_players');
};
