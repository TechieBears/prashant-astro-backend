const asyncHandler = require('express-async-handler');
const Service = require('./service.model');
const ServiceCategory = require('../serviceCategory/serviceCategory.model');
const Errorhander = require('../../utils/errorHandler');
const mongoose = require('mongoose');
// const { generateImageName } = require('../../utils/reusableFunctions');
const { deleteFile } = require('../../utils/storage');

exports.createServiceAdmin = asyncHandler(async (req, res, next) => {
    const { name, title, subTitle, htmlContent, category, price, durationInMinutes, gstNumber, hsnCode, isActive } = req.body;
    let serviceType = req.body.serviceType;
    let videoUrl = req.body.videoUrl;
    videoUrl = JSON.parse(videoUrl) || [];
    // use for each field validation
    for (const field of ['name', 'title', 'subTitle', 'htmlContent', 'category', 'videoUrl', 'price', 'durationInMinutes']) {
        if (!req.body[field]) {
            return next(new Errorhander(`Please provide ${field}`, 400));
        }
    }

    if (!mongoose.Types.ObjectId.isValid(category)) {
        return next(new Errorhander("Please provide valid category id", 400));
    }

    // serviceType validation
    const validServiceTypes = ['online', 'pandit_center', 'pooja_at_home'];
    console.log(serviceType);
    if (serviceType) {
        serviceType = JSON.parse(serviceType);
        if (!Array.isArray(serviceType)) {
            return next(new Errorhander("serviceType must be an array", 400));
        }

        for (const type of serviceType) {
            if (!validServiceTypes.includes(type)) {
                return next(
                    new Errorhander(
                        `Invalid service type: ${type}. Valid types are: ${validServiceTypes.join(", ")}`,
                        400
                    )
                );
            }
        }
    }

    const serviceExists = await Service.findOne({ name: name.trim() });
    if (serviceExists) {
        return next(new Errorhander("Service with this name already exists", 400));
    }

    // let imageName = generateImageName(req.files?.image?.[0]?.originalname);

    const imageFile = req.files?.image?.[0]
        ? `${process.env.BACKEND_URL}/${process.env.MEDIA_FILE}/services/${req.files.image[0].filename}` : null;

    const service = new Service({
        name: name.trim(),
        title: title.trim(),
        subTitle: subTitle.trim(),
        htmlContent: htmlContent.trim(),
        category,
        image: imageFile,
        isActive: isActive !== undefined ? isActive : true,
        videoUrl,
        price,
        gstNumber,
        hsnCode,
        durationInMinutes,
        serviceType: serviceType || ['online'],
        createdBy: req.user._id
    });
    await service.save();

    res.created(service, "Service created successfully");
});

exports.getAllServicesAdminPaginated = asyncHandler(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let filters = { isDeleted: false };

    // 🔍 Filter by service name
    if (req.query.name) {
        filters.name = { $regex: req.query.name, $options: "i" };
    }

    // 🔍 Filter by category id
    if (req.query.categoryId) {
        const matchingCategories = await ServiceCategory.find({
            _id: req.query.categoryId,
            isDeleted: false,
            isActive: true
        }).select("_id");

        if (matchingCategories.length > 0) {
            filters.category = { $in: matchingCategories.map(c => c._id) };
        } else {
            // no matching categories, return empty result
            return res.paginated([], { page, limit, total: 0, totalPages: 0 }, "No services found");
        }
    }

    if (req.query.durationInMinutes) {
        filters.durationInMinutes = req.query.durationInMinutes;
    }
    if (req.query.serviceType) {
        filters.serviceType = req.query.serviceType;
    }
    if (req.query.isActive) {
        filters.isActive = req.query.isActive === 'true';
    }

    const total = await Service.countDocuments(filters);

    const services = await Service.find(filters)
        .populate("category", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-__v");

    res.paginated(
        services,
        { page, limit, total, totalPages: Math.ceil(total / limit) },
        "Services fetched successfully"
    );
});

exports.getServiceAdmin = asyncHandler(async (req, res, next) => {
    const { id } = req.query;
    if (!id) {
        return next(new Errorhander("Please provide service id", 400));
    }

    const service = await Service.findOne({ _id: id, isDeleted: false }).select('-__v');
    if (!service) {
        return next(new Errorhander("Service not found", 404));
    }

    res.ok(service, "Service fetched successfully");
});

exports.getAllServicesDropdownAdmin = asyncHandler(async (req, res, next) => {
    const services = await Service.find({ isDeleted: false, isActive: true }).select('name _id').sort({ name: 1 });
    if (!services) {
        return next(new Errorhander("Services not found", 404));
    }

    res.ok(services, "Services fetched successfully");
});

exports.getAllServicesForAdmin = asyncHandler(async (req, res, next) => {
    const services = await Service.find({ isDeleted: false }).sort({ createdAt: -1 });
    if (!services) {
        return next(new Errorhander("Services not found", 404));
    }

    res.ok(services, "Services fetched successfully");
});

exports.updateServiceAdmin = asyncHandler(async (req, res, next) => {
    const { id } = req.query;
    if (!id) {
        return next(new Errorhander("Please provide service id", 400));
    }
    const { name, title, subTitle, description, serviceType, htmlContent, category, image, videoUrl, price, durationInMinutes, isActive, gstNumber, hsnCode } = req.body;

    const service = await Service.findOne({ _id: id, isDeleted: false });
    if (!service) {
        return next(new Errorhander("Service not found or deleted", 404));
    }

    if (name) {
        const nameExists = await Service.findOne({ name: name.trim(), _id: { $ne: id } });
        if (nameExists) {
            return next(new Errorhander("Service with this name already exists", 400));
        }
        service.name = name.trim();
    }

    if (req.files?.image?.[0]) {
        // let imageName = generateImageName(req.files.image[0].filename);
        if (banner.image) {
            deleteFile(banner.image)
        }
        service.image = `${process.env.BACKEND_URL}/${process.env.MEDIA_FILE}/services/${req.files.image[0].filename}`
    }

    if (title) service.title = title.trim();
    if (subTitle) service.subTitle = subTitle.trim();
    if (htmlContent) service.htmlContent = htmlContent.trim();
    if (videoUrl) service.videoUrl = videoUrl;
    if (category) {
        if (!mongoose.Types.ObjectId.isValid(category)) {
            return next(new Errorhander("Please provide valid category id", 400));
        }
        service.category = category;
    }
    // if (image) service.image = image;
    if (price !== undefined) service.price = price;
    if (gstNumber) service.gstNumber = gstNumber;
    if (hsnCode) service.hsnCode = hsnCode;
    if (serviceType) service.serviceType = serviceType;
    if (durationInMinutes) service.durationInMinutes = durationInMinutes;
    if (isActive !== undefined) service.isActive = isActive;

    service.updatedBy = req.user._id;
    await service.save();

    res.ok(service, "Service updated successfully");
});

exports.deleteServiceAdmin = asyncHandler(async (req, res, next) => {
    const { id } = req.query;
    if (!id) {
        return next(new Errorhander("Please provide service id", 400));
    }

    const service = await Service.findOne({ _id: id, isDeleted: false });
    if (!service) {
        return next(new Errorhander("Service not found", 404));
    }

    service.isDeleted = true;
    service.updatedBy = req.user._id;
    await service.save();
});

// Public Controllers
exports.getAllServicesPublicPaginated = asyncHandler(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let filters = { isDeleted: false };
    if (req.query.category) {
        filters.category = req.query.category;
    }
    if (req.query.search && req.query.search !== '') {
        filters.$or = [
            { name: { $regex: req.query.search, $options: 'i' } },
            { subTitle: { $regex: req.query.search, $options: 'i' } }
        ];
    }
    if (req.query.minPrice || req.query.maxPrice) {
        filters.price = {};
        if (req.query.minPrice) filters.price.$gte = parseFloat(req.query.minPrice);
        if (req.query.maxPrice) filters.price.$lte = parseFloat(req.query.maxPrice);
    }
    if (req.query.durationInMinutes) {
        filters.durationInMinutes = req.query.durationInMinutes;
    }
    if (req.query.serviceType) {
        filters.serviceType = req.query.serviceType;
    }
    if (req.query.isActive) {
        filters.isActive = req.query.isActive === 'true';
    }

    const total = await Service.countDocuments(filters);
    const services = await Service.find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-__v')
        .populate("category", "name");
    if (!services) {
        return next(new Errorhander("Services not found", 404));
    }

    res.paginated(services, { page, limit, total, totalPages: Math.ceil(total / limit) }, "Services fetched successfully");
});

exports.getAllServicesDropdownPublic = asyncHandler(async (req, res, next) => {
    const services = await Service.find({ isDeleted: false, isActive: true }).select('name _id').sort({ name: 1 });
    if (!services) {
        return next(new Errorhander("Services not found", 404));
    }

    res.ok(services, "Services fetched successfully");
});

exports.getAllServicesSoulplane = asyncHandler(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const services = await Service.find({ isDeleted: false, isActive: true }).sort({ createdAt: -1 }).skip(skip).limit(limit).select('name title htmlContent');
    if (!services) {
        return next(new Errorhander("Services not found", 404));
    }

    res.paginated(services, { page, limit, total: 0, totalPages: 0 }, "Services fetched successfully");
});

exports.getSingleServicePublic = asyncHandler(async (req, res, next) => {
    const { id } = req.query;
    if (!id) {
        return next(new Errorhander("Please provide service id", 400));
    }

    // 🔹 Find the service
    const service = await Service.findOne({
        _id: id,
        isDeleted: false,
        isActive: true
    })
        .select('-__v')
        .populate("category", "name image"); // optional: get category details

    if (!service) {
        return next(new Errorhander("Service not found", 404));
    }

    // 🔹 Fetch related services (same category, exclude current, limit 10)
    const relatedServices = await Service.find({
        category: service.category._id,
        _id: { $ne: service._id },
        isDeleted: false,
        isActive: true
    })
        .select("name title subTitle image price durationInMinutes serviceType") // pick only needed fields
        .limit(10);

    // 🔹 Build response
    const responseData = {
        ...service.toObject(),
        itemType: "service",
        relatedServices
    };

    res.ok(responseData, "Service fetched successfully");
});

exports.getOurServices = asyncHandler(async (req, res, next) => {

    const services = await Service.find({ isDeleted: false, isActive: true, category: req.query.categoryId }).sort({ createdAt: -1 }).limit(20).select('-__v -htmlContent -videoUrl -isActive -isDeleted -createdBy -updatedBy');

    if (!services) return next(new Errorhander("Services not found", 404));

    res.ok(services, "Our Services fetched successfully");
});

exports.getFilterData = asyncHandler(async (req, res, next) => {
    const categories = await ServiceCategory.find({ isActive: true, isDeleted: false }).select('name _id').sort({ name: 1 });
    res.ok({ category: categories }, "Filter data fetched successfully");
});

exports.getAllServicesPublicAstroGuidPaginated = asyncHandler(async (req, res, next) => {
    //   const { page = 1, limit = 10 } = req.query;
    //   const skip = (page - 1) * limit;

    // Aggregate categories with their services
    const categories = await ServiceCategory.aggregate([
        { $match: { isActive: true, isDeleted: false } },
        {
            $lookup: {
                from: "services",
                localField: "_id",
                foreignField: "category",
                as: "services",
                pipeline: [
                    { $match: { isActive: true, isDeleted: false } },
                    { $project: { _id: 1, name: 1, title: 1, subTitle: 1, price: 1, serviceType: 1, image: 1 } },
                    //   { $skip: skip },
                    //   { $limit: parseInt(limit) }
                ]
            }
        },
        {
            $project: {
                _id: 1,
                name: 1,
                description: 1,
                services: 1
            }
        }
    ]);

    res.ok(categories, "Categories with services fetched successfully");
});