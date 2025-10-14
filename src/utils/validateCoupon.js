const mongoose = require("mongoose");
const Coupon = require("../modules/coupon/coupon.model");
const Product = require("../modules/product/product.model");
const Service = require("../modules/service/service.model");
const ProductOrder = require("../modules/productOrder/productOrder.model");
const ServiceOrder = require("../modules/serviceOrder/serviceOrder.model");

exports.validateCoupon = async ({
  couponId,
  userId,
  type, // "product" or "service"
  itemIds, // productIds or serviceIds array
}) => {
  if (!couponId) return null;
  if (!mongoose.Types.ObjectId.isValid(couponId)) throw new Error("Invalid coupon ID");

  const coupon = await Coupon.findOne({ _id: couponId, isDeleted: false });
  if (!coupon) throw new Error("Coupon not found");
  if (!coupon.isActive) throw new Error("Coupon is inactive");

  const now = new Date();
  if (now < coupon.activationDate) throw new Error("Coupon not yet active");
  if (now > coupon.expiryDate) throw new Error("Coupon expired");

  // 🧠 Check coupon type applicability
  if (coupon.couponType !== "both" && coupon.couponType !== `${type}s`)
    throw new Error(`Coupon not applicable for ${type} orders`);

  // 🧮 Count redemption limits
  const [userServiceUses, userProductUses, totalServiceUses, totalProductUses] = await Promise.all([
    ServiceOrder.countDocuments({ user: userId, coupon: couponId }),
    ProductOrder.countDocuments({ user: userId, coupon: couponId }),
    ServiceOrder.countDocuments({ coupon: couponId }),
    ProductOrder.countDocuments({ coupon: couponId }),
  ]);

  const userTotalUses = userServiceUses + userProductUses;
  const totalUses = totalServiceUses + totalProductUses;

  if (coupon.redemptionPerUser > 0 && userTotalUses >= coupon.redemptionPerUser)
    throw new Error("Coupon usage limit reached for this user");

  if (coupon.totalRedemptions > 0 && totalUses >= coupon.totalRedemptions)
    throw new Error("Coupon usage limit reached globally");

  // 🎯 Validate applicability by type
  if (type === "service") {
    if (!coupon.applyAllServices) {
      const services = await Service.find({ _id: { $in: itemIds } }).populate("category");
      const isValidForAny = services.some((s) =>
        coupon.applicableServices.includes(s._id) ||
        coupon.applicableServiceCategories.includes(s.category?._id)
      );

      if (!isValidForAny)
        throw new Error("Coupon not applicable for selected services or categories");
    }
  }

  if (type === "product") {
    if (!coupon.applyAllProducts) {
      const products = await Product.find({ _id: { $in: itemIds } }).populate("category subcategory");

      const isValidForAny = products.some((p) =>
        coupon.applicableProducts.includes(p._id) ||
        coupon.applicableProductCategories.includes(p.category?._id) ||
        coupon.applicableProductSubcategories.includes(p.subcategory?._id)
      );

      if (!isValidForAny)
        throw new Error("Coupon not applicable for selected products/categories/subcategories");
    }
  }

  return coupon;
};