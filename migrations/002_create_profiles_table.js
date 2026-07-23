/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('profiles', (table) => {
    table.uuid('id').primary();
    table.uuid('user_id').unique().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('display_name', 100).notNullable();
    table.text('bio');
    table.string('gender', 20); // 'male', 'female', 'non-binary'
    table.string('relationship_status', 20).defaultTo('single');
    table.uuid('partner_id').references('id').inTable('users');
    table.integer('discovery_age_min').defaultTo(18);
    table.integer('discovery_age_max').defaultTo(50);
    table.string('discovery_gender', 20); // preference filter
    table.integer('discovery_genre_threshold').defaultTo(3);
    table.boolean('is_active').defaultTo(false);
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['user_id']);
    table.index(['is_active']);
  });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('profiles');
};
