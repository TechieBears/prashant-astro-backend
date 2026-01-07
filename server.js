const { createServer } = require("http");
const app = require("./app");
const connectDb = require("./src/config/db");
const { initSocket } = require("./src/config/socket");
const os = require("os");
const cron = require("node-cron");
const { checkPendingPayments } = require("./src/services/paymentCron.service");

(async () => {
  try {
    await connectDb();
    console.log("Database connected successfully");

    const server = createServer(app);
    
    // Initialize socket.io
    initSocket(server);

    const PORT = process.env.PORT || 3000;

    // get ip address
    const networkInterfaces = os.networkInterfaces();
    let ipAddress = "";
    Object.keys(networkInterfaces).forEach((interfaceName) => {
      const addresses = networkInterfaces[interfaceName];
      for (const address of addresses) {
        if (address.family === "IPv4" && !address.internal) {
          ipAddress = address.address;
        }
      }
    });

    server.listen(PORT, () => {
      console.log(`Server running on port: http://${ipAddress}:${PORT}`);
    });

    // Initialize cron job to check pending payments every 15 minutes
    // Cron expression: '*/15 * * * *' means every 15 minutes
    cron.schedule('*/1 * * * *', async () => {
      console.log('[Cron Job] Running pending payment check...');
      try {
        await checkPendingPayments();
      } catch (error) {
        console.error('[Cron Job] Error executing pending payment check:', error);
      }
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata" // Adjust timezone as needed
    });

    console.log('[Cron Job] Payment status check cron job initialized (runs every 15 minutes)');

  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
})();