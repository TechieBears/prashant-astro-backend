// Export all modules
module.exports = {
  AdminUser: require('./adminUser/adminUser.model'),
  Auth: require('./auth/auth.route'),
  CustomerUser: require('./customerUser/customerUser.model'),
  EmployeeUser: require('./employeeUser/employeeUser.model'),
  ProductCategory: require('./productCategory/productCategory.model'),
  ProductSubcategory: require('./productSubcategory/productSubcategory.model'),
  ServiceCategory: require('./serviceCategory/serviceCategory.model'),
};
