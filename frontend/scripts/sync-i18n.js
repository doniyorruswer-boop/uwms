import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvPath = path.resolve(__dirname, '../src/locales/translations.csv');
const localesDir = path.resolve(__dirname, '../src/locales');

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { languages: [], rows: [] };

  // Parse header
  const header = parseCSVLine(lines[0]);
  const keyIndex = header.indexOf('key');
  if (keyIndex === -1) {
    throw new Error('CSV must contain a "key" column in header');
  }

  const languages = header.filter((h) => h !== 'key');
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (!values[keyIndex]) continue;
    const key = values[keyIndex].trim();
    const row = { key };
    languages.forEach((lang) => {
      const idx = header.indexOf(lang);
      row[lang] = idx !== -1 && values[idx] !== undefined ? values[idx].trim() : '';
    });
    rows.push(row);
  }

  return { languages, rows };
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function setNestedProperty(obj, pathString, value) {
  const parts = pathString.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

function sync() {
  if (!fs.existsSync(csvPath)) {
    console.error(`Translations CSV not found at: ${csvPath}`);
    process.exit(1);
  }

  console.log(`[i18n-sync] Reading: ${csvPath}`);
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const { languages, rows } = parseCSV(csvContent);

  console.log(`[i18n-sync] Found languages: ${languages.join(', ')} (${rows.length} keys)`);

  languages.forEach((lang) => {
    const langObj = {};
    rows.forEach((row) => {
      const val = row[lang] || row['uz'] || row.key;
      setNestedProperty(langObj, row.key, val);
    });

    const outPath = path.join(localesDir, `${lang}.json`);
    fs.writeFileSync(outPath, JSON.stringify(langObj, null, 2), 'utf8');
    console.log(`[i18n-sync] Generated: ${outPath}`);
  });

  console.log('[i18n-sync] Successfully synchronized all translations from CSV!');
}

sync();
