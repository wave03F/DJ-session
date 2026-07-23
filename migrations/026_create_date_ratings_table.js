/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('date_ratings', (table) => {
    table.uuid('id').primary();
    table.uuid('date_id').notNullable()
      .references('id').inTable('dates').onDelete('CASCADE');
    table.uuid('rater_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.integer('rating').notNullable(); // 1-5 stars
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['date_id', 'rater_id']); // one rating per user per date
    table.check('?? BETWEEN 1 AND 5', ['rating']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('date_ratings');
};
