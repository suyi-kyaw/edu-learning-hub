const express = require('express');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const app = express();
const PORT = 3000;

// Enable CORS and cache control headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Helper to parse data/lessons.xlsx
function parseLessonsWorkbook() {
  const excelPath = path.join(__dirname, 'data', 'lessons.xlsx');
  if (!fs.existsSync(excelPath)) {
    throw new Error('data/lessons.xlsx not found');
  }

  const fileBuffer = fs.readFileSync(excelPath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheets = {};

  for (const sheetName of workbook.SheetNames) {
    sheets[sheetName] = XLSX.utils.sheet_to_json(
      workbook.Sheets[sheetName],
      { defval: '' }
    );
  }

  return {
    sheetNames: workbook.SheetNames,
    sheets
  };
}

// Generate static data/lessons.json as a fallback cache
function syncLessonsJson() {
  try {
    const data = parseLessonsWorkbook();
    const jsonPath = path.join(__dirname, 'data', 'lessons.json');
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
    console.log('Synchronized data/lessons.json successfully');
  } catch (err) {
    console.error('Failed to sync lessons.json:', err.message);
  }
}

// Initial sync
syncLessonsJson();

// Serve image assets with automatic SVG fallback and proper content-type
app.use('/assets/images', (req, res, next) => {
  const requestedFile = req.path.replace(/^\//, '');
  const filePath = path.join(__dirname, 'assets', 'images', requestedFile);

  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath);
      const str = data.toString('utf8', 0, 50);
      if (str.trim().startsWith('<svg')) {
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.send(data);
      }
    } catch (e) {
      // proceed to normal static
    }
  } else {
    // Try replacing extension with .svg
    const svgAlt = path.join(__dirname, 'assets', 'images', requestedFile.replace(/\.(jpg|jpeg|png)$/i, '.svg'));
    if (fs.existsSync(svgAlt)) {
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.sendFile(svgAlt);
    }
  }
  next();
});

// Serve API for lesson data parsed directly from Excel
app.get('/api/lessons-data', (req, res) => {
  try {
    const data = parseLessonsWorkbook();
    res.setHeader('Cache-Control', 'no-cache');
    res.json({
      success: true,
      ...data
    });
  } catch (err) {
    console.error('API lessons-data error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Serve static files from root directory
app.use(express.static(__dirname));

// Route handlers for convenient navigation
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/story', (req, res) => {
  res.sendFile(path.join(__dirname, 'story.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

