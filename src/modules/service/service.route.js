const express = require('express');
const router = express.Router();
const serviceController = require('./service.controller');
const { protect, authorize } = require('../../middlewares/auth');

// public routes
router.get("/public/get-all", serviceController.getAllServicesPublicPaginated);
router.get("/soulplane/public/get-all", serviceController.getAllServicesSoulplane);
router.get("/public/filter", serviceController.getFilterData);
router.get("/public/our-services", serviceController.getOurServices)
router.get("/public/dropdown", serviceController.getAllServicesDropdownPublic);
router.get("/public/get-single", serviceController.getSingleServicePublic);
router.get("/astroguid/public/get-all", serviceController.getAllServicesPublicAstroGuidPaginated);

// admin routes
router.use(protect, authorize('admin', "employee"));
router.post("/create", serviceController.createServiceAdmin);

router.get("/get-all", serviceController.getAllServicesAdminPaginated);
router.get("/get-single", serviceController.getServiceAdmin);
router.get("/dropdown", serviceController.getAllServicesDropdownAdmin);
router.get("/all", serviceController.getAllServicesForAdmin);

router.put("/update", serviceController.updateServiceAdmin);

router.delete("/delete", serviceController.deleteServiceAdmin);

module.exports = router;