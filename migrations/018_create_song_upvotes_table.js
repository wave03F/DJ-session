/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('song_upvotes', (table) => {
    table.uuid('id').primary();
    table.uuid('song_id').notNullable()
      .references('id').inTable('music_queue').onDelete('CASCADE');
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('socket_id', 50); // for guest votes
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['song_id', 'user_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('song_upvotes');
};
