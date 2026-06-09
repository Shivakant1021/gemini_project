require('dotenv').config();
const express = require('express');
const OpenAI = require('openai');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   NVIDIA CLIENT
========================= */
const openai = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: 'https://integrate.api.nvidia.com/v1'
});

/* =========================
   RENDER / PROXY FIX
========================= */
app.set('trust proxy', 1);

/* =========================
   MIDDLEWARE
========================= */
app.use(express.static('public'));
app.use(express.json({ limit: '10kb' }));
app.use(helmet());

/* =========================
   USER RATE LIMIT
   25 requests / hour / IP
========================= */
const userLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error:
      '⛔ You have reached your hourly limit (25 requests). Please try again later.'
  }
});

app.use('/api/gemini', userLimiter);

/* =========================
   GLOBAL NVIDIA PROTECTION
   Max ~30 requests/minute
========================= */
let lastRequestTime = 0;

async function waitForSlot() {
  const now = Date.now();
  const diff = now - lastRequestTime;

  if (diff < 2000) {
    await new Promise(resolve =>
      setTimeout(resolve, 2000 - diff)
    );
  }

  lastRequestTime = Date.now();
}

/* =========================
   HOME
========================= */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* =========================
   AI ENDPOINT
========================= */
app.post('/api/gemini', async (req, res) => {
  try {
    const { prompt } = req.body;

    /* Prompt Validation */
    if (
      !prompt ||
      typeof prompt !== 'string' ||
      prompt.trim().length === 0 ||
      prompt.length > 2000
    ) {
      return res.status(400).json({
        error: 'Invalid prompt'
      });
    }

    /* NVIDIA RPM Protection */
    await waitForSlot();

    /* AI Request + Timeout */
    const completion = await Promise.race([
      openai.chat.completions.create({
        model: 'meta/llama-3.1-8b-instruct',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 512
      }),

      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Request timeout')),
          15000
        )
      )
    ]);

    const text =
      completion?.choices?.[0]?.message?.content ||
      'No response';

    res.json({
      response: text
    });

  } catch (err) {
    console.error('AI Error:', err.message);

    res.status(503).json({
      error: 'AI service temporarily unavailable'
    });
  }
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});