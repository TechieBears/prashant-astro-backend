const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const morgan = require("morgan");
const errorMiddleware = require("./src/middlewares/error");
const responseMiddleware = require("./src/middlewares/response");
const helmet = require("helmet");
const path = require("path"); // ✅ added
require("dotenv").config();

const allowedOrigins = process.env.CORS_ORIGIN;

const app = express();
 
app.use(helmet());
app.use(morgan("common"));
app.use(cors({
    origin: function (origin, callback) {
      if (!origin) {
        // Allow requests like Postman / curl with no origin
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // Instead of throwing, reject gracefully
      return callback(new Error(`CORS not allowed for origin: ${origin}`), false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    optionsSuccessStatus: 200 // important for legacy browsers
  }));

app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ limit: "200mb", extended: true }));
app.use(cookieParser());

// standardized success response helpers
app.use(responseMiddleware);

// serve local uploads
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// application routes here
const routes = require("./src/routes");
app.use("/api", routes);


// ✅ Error handler
app.use(errorMiddleware);

// Optional: Catch unknown routes
// app.all('*', (req, res, next) => {
//     res.status(404).send(`URL Not Found: ${req.url}`);
// });

module.exports = app; 