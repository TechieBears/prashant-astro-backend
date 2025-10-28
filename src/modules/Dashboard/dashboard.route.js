const express = require('express');
const DashBoardController = require('./dashboard.controller');
const { protect, authorize } = require('../../middlewares/auth');

const router = express.Router();

router.get('/get-dashboard-data', protect, authorize('admin', "employee"), DashBoardController.getDashboardData);

module.exports = router; 
