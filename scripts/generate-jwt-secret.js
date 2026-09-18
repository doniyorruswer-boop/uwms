#!/usr/bin/env node
/**
 * UWMS — Kriptografik Xavfsiz Production JWT Secret Generatori
 * 
 * Ushbu skript 512-bit (64 bayt / 128 ta o'n oltilik belgi) entropiyaga ega
 * tasodifiy kriptografik sir kalitini hosil qiladi.
 * 
 * Ishlatish:
 *   node scripts/generate-jwt-secret.js
 */

const crypto = require('crypto');

const secret = crypto.randomBytes(64).toString('hex');

console.log('================================================================');
console.log('🔐 UWMS — Production Kriptografik JWT Kaliti Yaratildi:');
console.log('================================================================\n');
console.log(secret);
console.log('\n================================================================');
console.log('Qo‘llash tartibi (Production .env fayliga):');
console.log(`JWT_SECRET="${secret}"`);
console.log('================================================================');
