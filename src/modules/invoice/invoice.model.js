const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
    // Can be either product or service
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: false
    },
    serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: false
    },
    // Item details snapshot at time of invoice generation
    name: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    total: {
        type: Number,
        required: true,
        min: 0
    }
}, { _id: true });

const invoiceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    // Reference to the order (either product order or service order)
    productOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProductOrder',
        required: false
    },
    serviceOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceOrder',
        required: false
    },
    invoiceNumber: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    date: {
        type: Date,
        default: Date.now,
        required: true
    },
    // Issued to information (name and address)
    issuedTo: {
        name: {
            type: String,
            required: true,
            trim: true
        },
        address: {
            type: String,
            required: true,
            trim: true
        },
        city: {
            type: String,
            trim: true
        },
        state: {
            type: String,
            trim: true
        },
        postalCode: {
            type: String,
            trim: true
        },
        country: {
            type: String,
            trim: true
        },
        phoneNumber: {
            type: String,
            trim: true
        }
    },
    // List of products/services
    items: [invoiceItemSchema],
    subtotal: {
        type: Number,
        required: true,
        min: 0
    },
    // Payment information
    paymentInfo: {
        paymentMethod: {
            type: String,
            enum: ['COD', 'CASH', 'CARD', 'UPI', 'WALLET', 'NETBANKING'],
            required: true
        },
        paymentStatus: {
            type: String,
            enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
            required: true
        },
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        transactionId: {
            type: String
        },
        razorpayOrderId: {
            type: String
        },
        razorpayPaymentId: {
            type: String
        },
        details: {
            type: Object
        }
    },
    // Additional invoice details
    gst: {
        type: Number,
        default: 0,
        min: 0
    },
    discount: {
        type: Number,
        default: 0,
        min: 0
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: 'INR'
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Generate unique invoice number before saving
invoiceSchema.pre('save', async function (next) {
    // Only generate if invoiceNumber is not already set
    if (!this.invoiceNumber || this.invoiceNumber === '') {
        // Generate invoice number: INV-YYYYMMDD-XXXXXX (timestamp + random)
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        
        // Ensure uniqueness by checking database
        let isUnique = false;
        let attempts = 0;
        const InvoiceModel = this.constructor;
        const session = this.$session(); // Get session if document is in a transaction
        
        // Use a simpler approach: timestamp + random should be unique enough
        // If we're in a transaction, the uniqueness check might not work perfectly,
        // but the combination of date + random + timestamp should be sufficient
        while (!isUnique && attempts < 10) {
            const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
            const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
            this.invoiceNumber = `INV-${dateStr}-${randomStr}${timestamp}`;
            
            // Check for existing invoice number (use session if available)
            const query = InvoiceModel.findOne({ invoiceNumber: this.invoiceNumber });
            if (session) {
                query.session(session);
            }
            const existing = await query;
            
            if (!existing) {
                isUnique = true;
            } else {
                attempts++;
                // Add more randomness on retry
                await new Promise(resolve => setTimeout(resolve, 1));
            }
        }
        
        // Final fallback with more unique identifier
        if (!isUnique) {
            const timestamp = Date.now();
            const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
            this.invoiceNumber = `INV-${dateStr}-${timestamp.toString(36).toUpperCase()}-${randomPart}`;
        }
    }
    next();
});

// Indexes for better query performance
invoiceSchema.index({ userId: 1, createdAt: -1 });
invoiceSchema.index({ invoiceNumber: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);

