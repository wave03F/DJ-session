/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('avatar_equipped_items', (table) => {
    table.uuid('id').primary();
    table.uuid('avatar_id').notNullable()
      .references('id').inTable('avatars').onDelete('CASCADE');
    table.uuid('item_id').notNullable()
      .references('id').inTable('shop_items').onDelete('CASCADE');
    table.string('slot', 20).notNullable(); // hair, top, bottom, shoes, accessory
    table.string('color_override', 7); // custom color if item is recolorable

    table.unique(['avatar_id', 'slot']); // one item per slot
    table.index(['avatar_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('avatar_equipped_items');
};
