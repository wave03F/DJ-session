/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('shop_items', (table) => {
    table.uuid('id').primary();
    table.string('name', 100).notNullable();
    table.string('category', 20).notNullable(); // hair, top, bottom, shoes, accessory, outfit
    table.string('sprite_key', 100).notNullable(); // key for client-side sprite lookup
    table.string('color_default', 7); // default hex color (for recolorable items)
    table.boolean('is_recolorable').defaultTo(false);
    table.integer('price').defaultTo(0); // 0 = free
    table.boolean('is_premium').defaultTo(false);
    table.string('gender_restriction', 20); // null = all, 'male', 'female', 'non-binary'
    table.text('description');
    table.string('rarity', 20).defaultTo('common'); // common, rare, epic, legendary
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['category', 'is_premium']);
    table.index(['gender_restriction']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('shop_items');
};
