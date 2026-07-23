/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('user_inventory', (table) => {
    table.uuid('id').primary();
    table.uuid('user_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.uuid('item_id').notNullable()
      .references('id').inTable('shop_items').onDelete('CASCADE');
    table.string('acquired_via', 20).defaultTo('free'); // free, purchase, gift, event
    table.timestamp('acquired_at').defaultTo(knex.fn.now());

    table.unique(['user_id', 'item_id']);
    table.index(['user_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('user_inventory');
};
