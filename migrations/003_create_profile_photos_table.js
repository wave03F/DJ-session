/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('profile_photos', (table) => {
    table.uuid('id').primary();
    table.uuid('profile_id').notNullable()
      .references('id').inTable('profiles').onDelete('CASCADE');
    table.string('url', 500).notNullable();
    table.integer('position').notNullable();
    table.boolean('is_verified').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['profile_id']);
    table.check('?? BETWEEN 1 AND 6', ['position']);
  });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('profile_photos');
};
