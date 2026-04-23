const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();
const { bootstrapSchema } = require('./bootstrapSchema');

const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by CORS'));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};

app.use(cors(corsOptions));
// app.options('/*', cors(corsOptions));
app.use(express.json());

// Serve uploads folder as static files (must be before any auth middleware)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/sessions', require('./routes/sessions'));
app.use('/ordinances', require('./routes/ordinances'));
app.use('/resolutions', require('./routes/resolutions'));
app.use('/notifications', require('./routes/notifications'));
app.use('/users', require('./routes/users'));
app.use('/audit-logs', require('./routes/auditLogs'));
app.use('/settings', require('./routes/settings'));
app.use('/messages', require('./routes/messages'));
app.use('/votes', require('./routes/votes'));
app.use('/committees', require('./routes/committees'));

app.use('/reports', require('./routes/reports'));
app.use('/minutes', require('./routes/minutes'));
app.use('/committee-minutes', require('./routes/committee-minutes'));
app.use('/order-of-business', require('./routes/orderOfBusiness'));

app.use('/oob', require('./routes/oob'));
app.use('/committee-workflow', require('./routes/committeeWorkflow'));

// Global error handler — must be registered after all routes
app.use(require('./middleware/errorHandler'));

// --- Socket.IO setup ---
const http = require('http');
const server = http.createServer(app);

const { init } = require('./socket');
init(server); // initialize socket.io here

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await bootstrapSchema();
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to bootstrap database schema:', err);
    process.exit(1);
  }
}

startServer();
