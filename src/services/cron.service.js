const cron = require('node-cron');
const ServiceOrderItem = require('../modules/serviceOrder/serviceOrderItem.model');

// Reminder intervals (in minutes)
const INTERVALS = [
    2880, // 48 hours
    1440, // 24 hours
    480,  // 8 hours
    120,  // 2 hours
    30,   // 30 minutes
    2     // 2 minutes
];

const CRON_WINDOW = 30; // cron runs every 30 minutes

const every30MinutesTask = async () => {
    try {
        const now = new Date();
        console.log('🕒 Cron running at:', now.toISOString());

        const orders = await ServiceOrderItem.find({
            astrologerStatus: 'accepted',
            status: 'paid',
            paymentStatus: 'paid',
        });

        for (const order of orders) {
            const [hh, mm] = order.startTime.split(':');

            const serviceStart = new Date(order.bookingDate);
            serviceStart.setHours(hh, mm, 0, 0);

            const diffMinutes = Math.floor(
                (serviceStart - now) / 60000
            );

            for (const interval of INTERVALS) {
                if (
                    diffMinutes <= interval &&
                    diffMinutes > interval - CRON_WINDOW
                ) {
                    console.log(
                        `✅ TRIGGER | OrderId: ${order._id} | Reminder: ${interval} mins | Remaining: ${diffMinutes}`
                    );
                }
            }
        }

    } catch (err) {
        console.error('Cron error:', err);
    }
};

// 🕰 Runs every 30 minutes
cron.schedule('*/30 * * * *', every30MinutesTask, {
    timezone: 'Asia/Kolkata'
});

module.exports = { every30MinutesTask };