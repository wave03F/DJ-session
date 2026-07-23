/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('avatars', (table) => {
    table.uuid('id').primary();
    table.uuid('user_id').unique().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('body_type', 20).notNullable().defaultTo('male'); // male, female, non-binary
    table.string('hair_color', 7).defaultTo('#4a3728'); // hex
    table.string('skin_tone', 7).defaultTo('#f5d0a9'); // hex
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['user_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('avatars');
};
