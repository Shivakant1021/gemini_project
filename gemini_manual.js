require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;

/* =========================
   RENDER / PROXY FIX (MUST)
========================= */
app.set('trust proxy', 1);

/* =========================
   MIDDLEWARE
========================= */
app.use(express.static('public'));
app.use(express.json({ limit: '10kb' }));
app.use(helmet());

/* =========================
   USER RATE LIMIT (FRONTEND)
   10 requests / 6 hours / IP
========================= */
const userLimiter = rateLimit({
  windowMs: 6 * 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: '⛔ Too many requests. Try again after 6 hours.'
  }
});

app.use('/api/gemini', userLimiter);

/* =========================
   GEMINI THROTTLING (SERVER)
   Prevent RPM burst
========================= */
let lastGeminiCall = 0;
const GEMINI_COOLDOWN = 20_000; // 1 request / 20 sec

async function callGemini(prompt) {
  const now = Date.now();

  if (now - lastGeminiCall < GEMINI_COOLDOWN) {
    throw { status: 429, message: 'AI cooling down. Try again shortly.' };
  }

  lastGeminiCall = now;

  return axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`,
    {
      contents: [{ parts: [{ text: prompt }] }]
    },
    { headers: { 'Content-Type': 'application/json' } }
  );
}


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/gemini', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || prompt.length > 2000) {
    return res.status(400).json({ error: 'Invalid prompt' });
  }

  try {
    const response = await callGemini(prompt);

    const text =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      'No response';

    res.json({ response: text });

  } catch (err) {
    const status = err?.response?.status || err?.status;
    const data = err?.response?.data;

    console.error('Gemini error:', data || err.message);

    /* ===== GEMINI QUOTA HIT ===== */
    if (status === 429) {
      return res.status(429).json({
        error: '🤖 AI rate limit reached. Please try again later.'
      });
    }

    /* ===== SAFE FALLBACK ===== */
    res.status(503).json({
      error: 'AI service temporarily unavailable'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port http://localhost:${PORT}`);
});
