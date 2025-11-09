const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { sequelize } = require('./setup/database');
const { ensureCustomerColumns, ensureConfigColumns, ensureEmployeeColumns, ensureEmployeePaymentColumns, ensureProductColumns } = require('./setup/migrations');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const salesRoutes = require('./routes/sales');
const expenseRoutes = require('./routes/expenses');
const employeeRoutes = require('./routes/employees');
const dashboardRoutes = require('./routes/dashboard');
const configRoutes = require('./routes/config');
const companyRoutes = require('./routes/company');
const invoicesRoutes = require('./routes/invoices');
const customersRoutes = require('./routes/customers');
const destinationsRoutes = require('./routes/destinations');
const productMaterialsRoutes = require('./routes/productMaterials');
const imagesRoutes = require('./routes/images');
const productionRoutes = require('./routes/production');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));
app.use('/facturas', express.static(path.join(__dirname, '..', 'facturas')));

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Quimica AS API', version: '1.0.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/config', configRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/destinations', destinationsRoutes);
app.use('/api/product-materials', productMaterialsRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/images', imagesRoutes);

const PORT = process.env.PORT || 3001;

(async () => {
  try {
    // Evitamos alter:true por errores de FK en SQLite; mantenemos esquema estable
    await sequelize.sync();
    await ensureCustomerColumns();
    await ensureConfigColumns();
    await ensureEmployeeColumns();
    await ensureEmployeePaymentColumns();
    await ensureProductColumns();
    app.listen(PORT, () => {
      console.log(`API listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();