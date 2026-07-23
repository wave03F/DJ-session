/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('users', (table) => {
    table.uuid('id').primary();
    table.string('email', 255).unique().notNullable();
    table.string('password_hash', 255); // NULL for OAuth-only users
    table.string('nickname', 50).notNullable();
    table.date('date_of_birth').notNullable();
    table.boolean('age_verified').defaultTo(false);
    table.string('oauth_provider', 20); // 'line', 'google', 'facebook'
    table.string('oauth_id', 255);
    table.boolean('is_premium').defaultTo(false);
    table.timestamp('premium_expires_at');
    table.boolean('is_suspended').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('last_login_at');

    table.index(['email']);
    table.index(['oauth_provider', 'oauth_id']);
  });
};

/**
 * @param { import("knex").Knex } knex
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('users');
};
