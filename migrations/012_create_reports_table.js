/**
 * @param { import("knex").Knex } knex
 */
exports.up = function(knex) {
  return knex.schema.createTable('reports', (table) => {
    table.uuid('id').primary();
    table.uuid('reporter_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.uuid('reported_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('category', 30).notNullable(); // harassment, inappropriate_content, spam, fake_profile, underage
    table.text('description');
    table.string('status', 20).defaultTo('pending'); // pending, reviewed, action_taken, dismissed
    table.integer('priority').defaultTo(3); // 1=critical, 5=low
    table.uuid('reviewed_by');
    table.string('action_taken', 30); // warn, suspend, ban
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['reported_id', 'created_at']);
    table.index(['status', 'priority']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('reports');
};
