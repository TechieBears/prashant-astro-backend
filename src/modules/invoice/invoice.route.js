const express = require('express');
const invoiceController = require('./invoice.controller');
const { protect, authorize } = require('../../middlewares/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get invoice details by invoiceId or invoiceNumber
// GET /api/invoice/get-details?invoiceId=xxx OR ?invoiceNumber=INV-xxx
router.get('/get-details', authorize('customer', 'admin', 'employee'), invoiceController.getInvoiceDetails);

// Get all invoices (for customer: their own invoices, for admin/employee: all invoices)
// GET /api/invoice/get-all?page=1&limit=10
router.get('/get-all', authorize('customer', 'admin', 'employee'), invoiceController.getAllInvoices);

module.exports = router;

