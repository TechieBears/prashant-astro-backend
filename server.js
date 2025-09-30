const { createServer } = require("http");
const app = require("./app");
const connectDb = require("./src/config/db");
const os = require("os");

(async () => {
  try {
    await connectDb();
    console.log("Database connected successfully");

    const server = createServer(app);
    
    // Initialize socket.io
    // initSocket(server);

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

  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
})();