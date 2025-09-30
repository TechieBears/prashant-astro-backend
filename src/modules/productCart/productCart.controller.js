const asyncHandler = require('express-async-handler');
const ErrorHandler = require('../../utils/errorHandler');
const Product = require('../product/product.model');
const ProductCart = require('./productCart.model');

const calculateGrandTotal = (cart) => {
  cart.grandtotal = cart.items.reduce((acc, item) => acc + item.totalPrice, 0);
};

// @description    Add product to cart
// @route          POST /api/v1/product-cart/add
// @access         Private (customer)
exports.addToCart = asyncHandler(async (req, res, next) => {
    const { productId, quantity = 1 } = req.body;

    if (!productId) {
        return next(new ErrorHandler("Product ID is required", 400));
    }

    const product = await Product.findById(productId);
    if (!product) {
        return next(new ErrorHandler("Product not found", 404));
    }

    let cart = await ProductCart.findOne({ user: req.user._id });

    if(!cart) {
        // create new cart for user
        cart = new ProductCart({
            user: req.user._id,
            items: [{
                product: product._id,
                quantity,
                totalPrice: quantity * (product.sellingPrice || 0)
            }],
            totalAmount: quantity * (product.sellingPrice || 0)
        });
    } else {
        // check if product already exists
        const existingItem = cart.items.find(item => item.product.toString() === product._id.toString());

        if (existingItem) {
            existingItem.quantity += quantity;
            existingItem.totalPrice = existingItem.quantity * (product.sellingPrice || 0);
        } else {
            cart.items.push({
                product: product._id,
                quantity,
                totalPrice: quantity * (product.sellingPrice || 0)
            });
        }

        cart.totalAmount = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
    }

    await cart.save();
    await cart.populate('items.product', 'name price');

    // Transform items into desired structure
    const formattedItems = cart.items.map(item => ({
        _id: item._id,
        productId: item.product?._id,
        name: item.product?.name,
        price: item.product?.sellingPrice,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
        itemType: "product"
    }));
    
    res.ok({ items: formattedItems, totalAmount: cart.totalAmount }, "Product added to cart successfully");

});

// @description    Get user's cart
// @route          GET /api/v1/product-cart/get
// @access         Private (customer)
exports.getCart = asyncHandler(async (req, res, next) => {
    const cart = await ProductCart.aggregate([
        { $match: { user: req.user._id } },

        // Unwind items to join product details
        { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },

        // Lookup product details
        {
            $lookup: {
                from: "products",
                localField: "items.product",
                foreignField: "_id",
                as: "product"
            }
        },
        { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },

        // Project desired fields
        {
            $project: {
                _id: "$items._id",
                productId: "$product._id",
                name: "$product.name",
                price: "$product.sellingPrice",
                quantity: "$items.quantity",
                totalPrice: "$items.totalPrice",
                images: "$product.images",
                itemType: { $literal: "product" },
                totalAmount: "$totalAmount"
            }
        },

        // Group back cart items into array
        {
            $group: {
                _id: null,
                items: { $push: "$$ROOT" },
                totalAmount: { $first: "$totalAmount" }
            }
        }
    ]);

    if (!cart || cart.length === 0) {
        console.log("Cart is empty");
        return res.ok({ items: [], totalAmount: 0 }, "Cart is empty");
    }

    console.log(cart);

    const result = {
        items: cart[0].items.map(item => ({
            _id: item._id,
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            totalPrice: item.totalPrice,
            images: item.images,
            itemType: item.itemType
        })),
        totalAmount: cart[0].totalAmount
    };

    res.ok(result, "Cart fetched successfully");
});

// @description    Update product quantity in cart
// @route          PUT /api/v1/product-cart/update
// @access         Private (customer)
exports.updateQuantity = asyncHandler(async (req, res, next) => {
    const { itemId, quantity } = req.body;
    if (!itemId || !quantity || quantity < 1) {
        return next(new ErrorHandler("Valid itemId and quantity are required", 400));
    }

    let cart = await ProductCart.findOne({ user: req.user._id });
    if (!cart) {
        return next(new ErrorHandler("Cart not found", 404));
    }

    const item = cart.items.id(itemId);
    if (!item) {
        return next(new ErrorHandler("Item not found in cart", 404));
    }
    
    const product = await Product.findById(item.product);
    if (!product) {
        return next(new ErrorHandler("Associated product not found", 404));
    }
    
    item.quantity = quantity;
    item.totalPrice = quantity * (product.sellingPrice || 0);

    cart.totalAmount = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
    await cart.save();
    await cart.populate('items.product', 'name price');

    // Transform items into desired structure
    const formattedItems = cart.items.map(item => ({
        _id: item._id,
        productId: item.product?._id,
        name: item.product?.name,
        price: item.product?.sellingPrice,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
        itemType: "product"
    }));

    res.ok({ items: formattedItems, totalAmount: cart.totalAmount }, "Cart item updated successfully");
});

// @description    Remove a product from cart
// @route          PUT /api/v1/product-cart/remove-item
// @access         Private (customer)
exports.removeItem = asyncHandler(async (req, res, next) => {
    const { itemId } = req.body;
    if (!itemId) {
        return next(new ErrorHandler("itemId is required", 400));
    }

    let cart = await ProductCart.findOne({ user: req.user._id });
    if (!cart) {
        return res.ok({ items: [], totalAmount: 0 }, "Cart is empty");
    }

    const itemIndex = cart.items.findIndex((item) => item._id.toString() === itemId);
    if (itemIndex === -1) return res.ok({ items: [], totalAmount: 0 }, "Item not found in cart");

    // if last item is removed, delete cart
    if (cart.items.length === 1) {
        await cart.deleteOne();
        return res.ok({ items: [], totalAmount: 0 }, "Cart is now empty");
    }

    cart.items.splice(itemIndex, 1);
    calculateGrandTotal(cart);
    await cart.save();
    await cart.populate('items.product', 'name price');

    // Transform items into desired structure
    const formattedItems = cart.items.map(item => ({
        _id: item._id,
        productId: item.product?._id,
        name: item.product?.name,
        price: item.product?.sellingPrice,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
        itemType: "product"
    }));

    res.ok({ items: formattedItems, totalAmount: cart.totalAmount }, "Item removed from cart successfully");
});

// @description    Clear all products from cart
// @route          DELETE /api/v1/product-cart/clear
// @access         Private (customer)
exports.removeAllFromCart = asyncHandler(async (req, res, next) => {
    let cart = await ProductCart.findOneAndDelete({ user: req.user._id });
    if (!cart) {
        return next(new ErrorHandler("Cart not found", 404));
    }
    res.ok({ items: [], totalAmount: 0 }, "Cart cleared successfully");
});