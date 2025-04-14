const fs = require('fs');
const { createCanvas } = require('canvas');
const path = require('path');

// Upewnij się, że katalog istnieje
const imgDir = path.join(__dirname, 'public', 'img');
if (!fs.existsSync(imgDir)) {
  fs.mkdirSync(imgDir, { recursive: true });
}

// Funkcja do generowania prostej ikony
function generateIcon(size, filename, backgroundColor = '#128C7E', textColor = '#FFFFFF') {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Tło
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, size, size);
  
  // Tekst
  ctx.fillStyle = textColor;
  ctx.font = `bold ${size * 0.5}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('W', size / 2, size / 2);
  
  // Zapisz jako PNG
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(imgDir, filename), buffer);
  console.log(`Generated ${filename}`);
}

// Generuj różne rozmiary ikon
generateIcon(16, 'favicon-16x16.png');
generateIcon(32, 'favicon-32x32.png');
generateIcon(180, 'apple-touch-icon.png');
generateIcon(192, 'android-chrome-192x192.png');
generateIcon(512, 'android-chrome-512x512.png');

// Generuj obrazy dla social media
function generateSocialImage(width, height, filename, text) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Tło
  ctx.fillStyle = '#128C7E';
  ctx.fillRect(0, 0, width, height);
  
  // Tekst
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${height * 0.15}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2);
  
  // Zapisz jako JPG
  const buffer = canvas.toBuffer('image/jpeg');
  fs.writeFileSync(path.join(imgDir, filename), buffer);
  console.log(`Generated ${filename}`);
}

generateSocialImage(1200, 630, 'og-image.jpg', 'WhatsApp to Google Chat');
generateSocialImage(1200, 600, 'twitter-image.jpg', 'WhatsApp to Google Chat');

console.log('All icons generated successfully!');
