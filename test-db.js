require('dotenv').config();
const fs = require('fs');
const knex = require('knex')(require('./knexfile').development);

knex.migrate.latest()
  .then((result) => {
    const msg = 'MIGRATE OK: batch ' + result[0] + ', ' + result[1].length + ' new migrations';
    console.log(msg);
    fs.writeFileSync('migrate-result.txt', msg + '\n' + JSON.stringify(result[1]));
  })
  .catch((e) => {
    const msg = 'MIGRATE ERROR: ' + e.message;
    console.log(msg);
    fs.writeFileSync('migrate-result.txt', msg);
  })
  .finally(() => {
    knex.destroy();
  });
