require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const socketServer = require('./socket');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

const MONGO_URI = process.env.MONGO_URI; 

// 👇 FIXED: Removed the deprecated options object completely
mongoose.connect(MONGO_URI)
.then(() => console.log('✅ MongoDB Atlas Connected!'))
.catch(err => console.error('❌ DB Connection Error:', err));

socketServer(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));