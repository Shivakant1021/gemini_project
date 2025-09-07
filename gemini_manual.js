
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = process.env.PORT;
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const API_KEY = process.env.GEMINI_API_KEY;

app.use(express.static('public'));
app.use(express.json());
app.use(helmet());



// ✅ Rate limiter (10 requests per 6 hours per IP)
const limiter = rateLimit({
  windowMs: 6 * 60 * 60 * 1000, // 6 hours
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '⛔ Too many requests. Try again after 6 hours.' },
});

app.use('/api/gemini', limiter);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API route to call Gemini
app.post('/api/gemini', async (req, res) => {
  const { prompt } = req.body;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const text = response.data.candidates[0]?.content?.parts[0]?.text || 'No response';
    res.json({ response: text });
  } catch (err) {
    console.error('Gemini API error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Gemini API failed' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
