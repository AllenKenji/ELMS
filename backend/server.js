const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const corsOptions = {
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};

app.use(cors(corsOptions));
// app.options('/*', cors(corsOptions));
app.use(express.json());

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

// Global error handler — must be registered after all routes
app.use(require('./middleware/errorHandler'));

// --- Socket.IO setup ---
const http = require('http');
const server = http.createServer(app);

const { init } = require('./socket');
init(server); // initialize socket.io here

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
