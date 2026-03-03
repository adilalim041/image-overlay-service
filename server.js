const express = require('express');
const sharp = require('sharp');
const https = require('https');
const http = require('http');

const app = express();
app.use(express.json());

// Скачиваем картинку по URL
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// Разбиваем текст на строки по maxChars символов
function wrapText(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length <= maxChars) {
      current = (current + ' ' + word).trim();
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// POST /overlay - делает обложку: фото + затемнение + заголовок
app.post('/overlay', async (req, res) => {
  try {
    const { imageUrl, headline, headline2 } = req.body;
    if (!imageUrl || !headline) {
      return res.status(400).json({ error: 'imageUrl and headline required' });
    }

    const imgBuffer = await downloadImage(imageUrl);
    const img = sharp(imgBuffer);
    const meta = await img.metadata();
    const W = meta.width || 1024;
    const H = meta.height || 1024;

    const fontSize1 = Math.round(W * 0.09);   // headline
    const fontSize2 = Math.round(W * 0.085);  // headline2 (жёлтый)
    const lineH1 = Math.round(fontSize1 * 1.2);
    const lineH2 = Math.round(fontSize2 * 1.2);
    const paddingBottom = Math.round(H * 0.08);
    const paddingX = Math.round(W * 0.06);

    const h1Lines = wrapText(headline.toUpperCase(), 14);
    const h2Lines = headline2 ? wrapText(headline2.toUpperCase(), 14) : [];

    const totalTextH = h1Lines.length * lineH1 + h2Lines.length * lineH2 + 20;
    const gradientH = Math.round(H * 0.55);
    const textStartY = H - paddingBottom - totalTextH;

    // SVG оверлей: градиент снизу + текст
    let svgText = '';
    let y = textStartY;

    for (const line of h1Lines) {
      svgText += `<text x="${paddingX}" y="${y + lineH1}" 
        font-family="Arial Black, Arial, sans-serif" 
        font-size="${fontSize1}" 
        font-weight="900"
        fill="white"
        stroke="black"
        stroke-width="3"
        paint-order="stroke"
        letter-spacing="2">${line}</text>`;
      y += lineH1;
    }

    for (const line of h2Lines) {
      svgText += `<text x="${paddingX}" y="${y + lineH2}" 
        font-family="Arial Black, Arial, sans-serif" 
        font-size="${fontSize2}" 
        font-weight="900"
        fill="#FFD700"
        stroke="black"
        stroke-width="3"
        paint-order="stroke"
        letter-spacing="2">${line}</text>`;
      y += lineH2;
    }

    const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="black" stop-opacity="0"/>
          <stop offset="100%" stop-color="black" stop-opacity="0.82"/>
        </linearGradient>
      </defs>
      <rect x="0" y="${H - gradientH}" width="${W}" height="${gradientH}" fill="url(#grad)"/>
      ${svgText}
    </svg>`;

    const overlayBuf = Buffer.from(svg);

    const result = await sharp(imgBuffer)
      .resize(1080, 1350, { fit: 'cover', position: 'center' })
      .composite([{ input: overlayBuf, top: 0, left: 0 }])
      .jpeg({ quality: 92 })
      .toBuffer();

    res.set('Content-Type', 'image/jpeg');
    res.send(result);

  } catch (err) {
    console.error('Overlay error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /textcard - делает текстовую карточку: тёмный фон + body + conclusion
app.post('/textcard', async (req, res) => {
  try {
    const { body, conclusion } = req.body;
    if (!body) return res.status(400).json({ error: 'body required' });

    const W = 1080;
    const H = 1350;
    const paddingX = 70;
    const fontSize = 36;
    const lineH = 52;
    const conclusionFontSize = 32;
    const conclusionLineH = 46;

    const bodyLines = wrapText(body, 38);
    const conclusionLines = conclusion ? wrapText(conclusion, 38) : [];

    let svgContent = '';
    let y = 120;

    // Декоративная линия сверху
    svgContent += `<rect x="${paddingX}" y="80" width="120" height="6" rx="3" fill="#FFD700"/>`;

    // Body текст
    for (const line of bodyLines) {
      svgContent += `<text x="${paddingX}" y="${y + fontSize}" 
        font-family="Arial, sans-serif" 
        font-size="${fontSize}"
        fill="white"
        opacity="0.92">${line}</text>`;
      y += lineH;
    }

    y += 40;

    // Разделитель
    svgContent += `<rect x="${paddingX}" y="${y}" width="${W - paddingX * 2}" height="2" fill="#FFD700" opacity="0.5"/>`;
    y += 30;

    // Conclusion
    for (const line of conclusionLines) {
      svgContent += `<text x="${paddingX}" y="${y + conclusionFontSize}" 
        font-family="Arial, sans-serif" 
        font-size="${conclusionFontSize}"
        font-style="italic"
        fill="#FFD700">${line}</text>`;
      y += conclusionLineH;
    }

    const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${W}" height="${H}" fill="#111111"/>
      <rect x="0" y="0" width="${W}" height="${H}" fill="#1a1a2e" opacity="0.6"/>
      ${svgContent}
    </svg>`;

    const result = await sharp(Buffer.from(svg))
      .jpeg({ quality: 92 })
      .toBuffer();

    res.set('Content-Type', 'image/jpeg');
    res.send(result);

  } catch (err) {
    console.error('Textcard error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/', (req, res) => res.json({ status: 'ok', service: 'image-overlay' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
