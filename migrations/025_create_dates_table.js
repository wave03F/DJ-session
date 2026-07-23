/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('dates', (table) => {
    table.uuid('id').primary();
    table.uuid('invitation_id').notNullable()
      .references('id').inTable('date_invitations').onDelete('CASCADE');
    table.uuid('user1_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.uuid('user2_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('theme', 30).notNullable();
    table.string('status', 20).defaultTo('active'); // active, completed, cancelled
    table.timestamp('started_at').defaultTo(knex.fn.now());
    table.timestamp('ended_at');
    table.integer('duration_minutes');

    table.index(['user1_id', 'status']);
    table.index(['user2_id', 'status']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('dates');
};
