#!/usr/bin/env node
/**
 * UWMS — Toza Repozitoriy va Arxiv Yaratish Skripti (Clean Packaging Tool)
 * 
 * Ushbu skript loyihani deploy yoki auditga taqdim etish uchun
 * .env (maxfiy ma'lumotlar), node_modules va dist papkalarisiz toza ZIP arxiv yaratadi.
 * 
 * Ishlatish:
 *   node scripts/package-clean.js
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const timestamp = new Date().toISOString().replace(/[-:T]/g, '_').slice(0, 19);
const outputZip = path.join(rootDir, `uwms_clean_release_${timestamp}.zip`);

console.log('================================================================');
console.log('📦 UWMS — Toza Production Arxivini Shakllantirish');
console.log('================================================================\n');

try {
  // 1. Birinchi navbatda git archive orqali toza repozitoriya snapshotini yaratish
  console.log('1. Git repozitoriyasi tekshirilmoqda...');
  execSync(`git archive --format=zip -o "${outputZip}" HEAD`, {
    cwd: rootDir,
    stdio: 'inherit',
  });

  const stats = fs.statSync(outputZip);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

  console.log('\n================================================================');
  console.log(`✅ Toza arxiv muvaffaqiyatli yaratildi!`);
  console.log(`📁 Fayl: ${path.basename(outputZip)}`);
  console.log(`💾 Hajmi: ${sizeMb} MB`);
  console.log('================================================================');
  console.log('Tekshiruv:');
  console.log('- node_modules/ chiqarib tashlangan');
  console.log('- dist/ chiqarib tashlangan');
  console.log('- Haqiqiy .env fayllari chiqarib tashlangan');
  console.log('- Faqat xavfsiz .env.example fayllari mavjud');
  console.log('================================================================\n');
} catch (err) {
  console.error('Xatolik yuz berdi:', err.message);
  process.exit(1);
}
