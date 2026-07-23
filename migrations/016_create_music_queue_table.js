/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('music_queue', (table) => {
    table.uuid('id').primary();
    table.uuid('room_id').notNullable()
      .references('id').inTable('rooms').onDelete('CASCADE');
    table.string('video_id', 20).notNullable();
    table.string('title', 300).notNullable();
    table.uuid('added_by').references('id').inTable('users').onDelete('SET NULL');
    table.string('added_by_nickname', 100);
    table.integer('upvotes').defaultTo(0);
    table.integer('position').notNullable(); // queue order
    table.boolean('is_playing').defaultTo(false);
    table.boolean('is_played').defaultTo(false); // already finished
    table.timestamp('started_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['room_id', 'is_played', 'position']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('music_queue');
};
