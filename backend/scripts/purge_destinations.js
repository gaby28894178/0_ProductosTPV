const { sequelize } = require('../src/setup/database');
const Destination = require('../src/models/Destination');

(async () => {
  try {
    await sequelize.authenticate();
    const count = await Destination.destroy({ where: {}, truncate: true });
    console.log(`Destinos eliminados: ${count}`);
    process.exit(0);
  } catch (e) {
    console.error('Error purgando destinos:', e);
    process.exit(1);
  }
})();