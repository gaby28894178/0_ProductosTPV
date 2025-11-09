const { sequelize } = require('./database')

async function ensureCustomerColumns() {
  const qi = sequelize.getQueryInterface()
  try {
    const table = await qi.describeTable('Customers')
    if (!table.email) {
      await qi.addColumn('Customers', 'email', { type: sequelize.Sequelize.STRING })
    }
    if (!table.telefono) {
      await qi.addColumn('Customers', 'telefono', { type: sequelize.Sequelize.STRING })
    }
  } catch (err) {
    // If table doesn't exist yet, sync will create it; ignore here
    console.warn('ensureCustomerColumns warning:', err.message)
  }
}

async function ensureConfigColumns() {
  const qi = sequelize.getQueryInterface()
  try {
    const table = await qi.describeTable('Configs')
    if (!table.capitalExtra) {
      await qi.addColumn('Configs', 'capitalExtra', { type: sequelize.Sequelize.FLOAT, defaultValue: 0 })
    }
    if (!table.backupName) {
      await qi.addColumn('Configs', 'backupName', { type: sequelize.Sequelize.STRING })
    }
    // Nuevos campos para backup semanal
    if (!table.backupSemanalActivo) {
      await qi.addColumn('Configs', 'backupSemanalActivo', { type: sequelize.Sequelize.BOOLEAN, defaultValue: false })
    }
    if (!table.backupSemanalDia) {
      await qi.addColumn('Configs', 'backupSemanalDia', { type: sequelize.Sequelize.INTEGER, defaultValue: 1 })
    }
    if (!table.backupSemanalHora) {
      await qi.addColumn('Configs', 'backupSemanalHora', { type: sequelize.Sequelize.STRING, defaultValue: '09:00' })
    }
  } catch (err) {
    console.warn('ensureConfigColumns warning:', err.message)
  }
}

async function ensureEmployeeColumns() {
  const qi = sequelize.getQueryInterface()
  try {
    const table = await qi.describeTable('Employees')
    if (!table.sueldoMensual) {
      await qi.addColumn('Employees', 'sueldoMensual', { type: sequelize.Sequelize.FLOAT, defaultValue: 0 })
    }
  } catch (err) {
    console.warn('ensureEmployeeColumns warning:', err.message)
  }
}

async function ensureEmployeePaymentColumns() {
  const qi = sequelize.getQueryInterface()
  try {
    const table = await qi.describeTable('EmployeePayments')
    if (!table.categoria) {
      await qi.addColumn('EmployeePayments', 'categoria', { type: sequelize.Sequelize.STRING })
    }
    if (!table.mes) {
      await qi.addColumn('EmployeePayments', 'mes', { type: sequelize.Sequelize.STRING })
    }
  } catch (err) {
    console.warn('ensureEmployeePaymentColumns warning:', err.message)
  }
}

async function ensureProductColumns() {
  const qi = sequelize.getQueryInterface()
  try {
    const table = await qi.describeTable('Products')
    if (!table.nombreBoleta) {
      await qi.addColumn('Products', 'nombreBoleta', { type: sequelize.Sequelize.STRING })
    }
    if (!table.esMayorista) {
      await qi.addColumn('Products', 'esMayorista', { type: sequelize.Sequelize.BOOLEAN, defaultValue: false })
    }
    if (!table.rendimientoLitrosPorEmpaque) {
      await qi.addColumn('Products', 'rendimientoLitrosPorEmpaque', { type: sequelize.Sequelize.INTEGER, defaultValue: 0 })
    }
    if (!table.imagenUrl) {
      await qi.addColumn('Products', 'imagenUrl', { type: sequelize.Sequelize.STRING })
    }
  } catch (err) {
    console.warn('ensureProductColumns warning:', err.message)
  }
}

module.exports = { ensureCustomerColumns, ensureConfigColumns, ensureEmployeeColumns, ensureEmployeePaymentColumns, ensureProductColumns }