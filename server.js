const express = require('express');
const sharp = require('sharp');
const https = require('https');
const http = require('http');
const opentype = require('opentype.js');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));

// Загружаем шрифты с кириллицей
const fontBold = opentype.loadSync(path.join(__dirname, 'fonts/bold.ttf'));
const fontRegular = opentype.loadSync(path.join(__dirname, 'fonts/regular.ttf'));

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadImage(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function wrapText(text, font, fontSize, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? current + ' ' + word : word;
    if (font.getAdvanceWidth(test, fontSize) <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// POST /overlay — фото + градиент + заголовок
app.post('/overlay', async (req, res) => {
  try {
    const { imageUrl, headline, headline2 } = req.body;
    if (!imageUrl || !headline) return res.status(400).json({ error: 'imageUrl and headline required' });

    const W = 1080, H = 1350;
    const paddingX = 60;
    const paddingBottom = 80;
    const fs1 = 105, lh1 = 120;
    const fs2 = 98, lh2 = 113;

    const h1Lines = wrapText(headline.toUpperCase(), fontBold, fs1, W - paddingX * 2);
    const h2Lines = headline2 ? wrapText(headline2.toUpperCase(), fontBold, fs2, W - paddingX * 2) : [];
    const totalH = h1Lines.length * lh1 + h2Lines.length * lh2;

    let y = H - paddingBottom - totalH;
    let textPaths = '';

    for (const line of h1Lines) {
      const shadow = fontBold.getPath(line, paddingX + 4, y + lh1 + 4, fs1);
      textPaths += `<path d="${shadow.toPathData(2)}" fill="rgba(0,0,0,0.75)"/>`;
      const main = fontBold.getPath(line, paddingX, y + lh1, fs1);
      textPaths += `<path d="${main.toPathData(2)}" fill="white"/>`;
      y += lh1;
    }
    for (const line of h2Lines) {
      const shadow = fontBold.getPath(line, paddingX + 4, y + lh2 + 4, fs2);
      textPaths += `<path d="${shadow.toPathData(2)}" fill="rgba(0,0,0,0.75)"/>`;
      const main = fontBold.getPath(line, paddingX, y + lh2, fs2);
      textPaths += `<path d="${main.toPathData(2)}" fill="#FFD700"/>`;
      y += lh2;
    }

    const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="black" stop-opacity="0"/>
          <stop offset="55%" stop-color="black" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="black" stop-opacity="0.9"/>
        </linearGradient>
      </defs>
      <rect x="0" y="${H - 650}" width="${W}" height="650" fill="url(#g)"/>
      ${textPaths}
    </svg>`;

    const imgBuf = await downloadImage(imageUrl);
    const result = await sharp(imgBuf)
      .resize(W, H, { fit: 'cover', position: 'center' })
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .jpeg({ quality: 92 })
      .toBuffer();

    res.set('Content-Type', 'image/jpeg');
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /textcard — тёмный фон + текст
app.post('/textcard', async (req, res) => {
  try {
    const { body, conclusion } = req.body;
    if (!body) return res.status(400).json({ error: 'body required' });

    const W = 1080, H = 1350;
    const px = 65;
    const bfs = 37, blh = 54;
    const cfs = 33, clh = 48;
    const maxW = W - px * 2;

    const bodyLines = wrapText(body, fontRegular, bfs, maxW);
    const conclusionLines = conclusion ? wrapText(conclusion, fontRegular, cfs, maxW) : [];

    let paths = '';
    let y = 100;

    // Жёлтая линия
    paths += `<rect x="${px}" y="72" width="130" height="7" rx="3" fill="#FFD700"/>`;

    for (const line of bodyLines) {
      const p = fontRegular.getPath(line, px, y + bfs, bfs);
      paths += `<path d="${p.toPathData(2)}" fill="rgba(255,255,255,0.93)"/>`;
      y += blh;
    }

    y += 40;
    paths += `<rect x="${px}" y="${y}" width="${maxW}" height="2" fill="#FFD700" opacity="0.55"/>`;
    y += 32;

    for (const line of conclusionLines) {
      const p = fontRegular.getPath(line, px, y + cfs, cfs);
      paths += `<path d="${p.toPathData(2)}" fill="#FFD700"/>`;
      y += clh;
    }

    const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${W}" height="${H}" fill="#0f0f0f"/>
      ${paths}
    </svg>`;

    const result = await sharp(Buffer.from(svg))
      .jpeg({ quality: 92 })
      .toBuffer();

    res.set('Content-Type', 'image/jpeg');
    res.send(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => res.json({ status: 'ok', version: 2 }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
