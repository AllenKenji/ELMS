const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
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

// --- Socket.IO setup ---
const http = require('http');
const server = http.createServer(app);

const { init } = require('./socket');
init(server); // initialize socket.io here

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
