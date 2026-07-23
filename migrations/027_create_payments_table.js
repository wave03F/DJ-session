/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('payments', (table) => {
    table.uuid('id').primary();
    table.uuid('user_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('omise_charge_id', 100); // Omise charge ID
    table.decimal('amount', 10, 2).notNullable();
    table.string('currency', 3).defaultTo('THB');
    table.string('payment_method', 30); // credit_card, promptpay, mobile_banking
    table.string('status', 20).defaultTo('pending'); // pending, successful, failed, refunded
    table.string('item_type', 30); // subscription, virtual_item, vip_ticket
    table.uuid('item_id'); // references the purchased item
    table.jsonb('metadata'); // extra info
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index(['user_id', 'status']);
    table.index(['omise_charge_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('payments');
};
