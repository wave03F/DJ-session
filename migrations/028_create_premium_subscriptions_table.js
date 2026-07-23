/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('premium_subscriptions', (table) => {
    table.uuid('id').primary();
    table.uuid('user_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.uuid('payment_id').references('id').inTable('payments').onDelete('SET NULL');
    table.string('plan', 20).defaultTo('monthly'); // monthly, yearly
    table.decimal('amount', 10, 2).notNullable();
    table.string('currency', 3).defaultTo('THB');
    table.string('status', 20).defaultTo('active'); // active, cancelled, expired
    table.timestamp('starts_at').defaultTo(knex.fn.now());
    table.timestamp('expires_at').notNullable();
    table.timestamp('cancelled_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['user_id', 'status']);
    table.index(['expires_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('premium_subscriptions');
};
