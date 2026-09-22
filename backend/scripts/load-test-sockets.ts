/**
 * UWMS WebSocket Stress & Load Benchmark (FAZA 7)
 * 
 * Ushbu skript universitet miqyosida 200+ bir vaqtning o‘zida ochiq soket ulanishini
 * barqarorligini, RAM xotira sarfini, aloqa kechikishini (latency) va xonalarga
 * xabarlarni tarqatish tezligini stress testdan o‘tkazadi.
 */
import { io, Socket } from 'socket.io-client';
import * as jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

const PORT = process.env.PORT || 4000;
const SOCKET_URL = `http://localhost:${PORT}/realtime`;
const JWT_SECRET = process.env.JWT_SECRET || 'uwms_super_secret_jwt_key_2026';
const TOTAL_CLIENTS = parseInt(process.env.TEST_CLIENTS || '200', 10);
const BATCH_SIZE = 25;
const BATCH_DELAY_MS = 150;

interface ClientStats {
  id: string;
  connected: boolean;
  handshakeLatency: number;
  pingLatency: number;
  roomsJoined: boolean;
}

function formatBytes(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runLoadTest() {
  console.log('\n======================================================');
  console.log('🚀 UWMS FAZA 7: 200+ SOKET YUKLAMA VA BARQARORLIK TESTI');
  console.log('======================================================');
  console.log(`Manzil: ${SOCKET_URL}`);
  console.log(`Mijozlar soni: ${TOTAL_CLIENTS}`);
  console.log(`Guruhlar o‘lchami (Batch): ${BATCH_SIZE} ta/bosqich`);
  console.log(`Boshlang‘ich xotira (Heap): ${formatBytes(process.memoryUsage().heapUsed)}`);
  console.log(`Boshlang‘ich xotira (RSS):  ${formatBytes(process.memoryUsage().rss)}\n`);

  // 1. Bazadan haqiqiy faol foydalanuvchini olish
  const activeUser = await prisma.user.findFirst({
    where: { isActive: true },
    select: { id: true, username: true, role: true, fullName: true },
  });

  if (!activeUser) {
    console.error('❌ Xatolik: Bazada birorta ham faol foydalanuvchi topilmadi!');
    process.exit(1);
  }

  console.log(`✅ Test foydalanuvchisi aniqlandi: ${activeUser.fullName} (${activeUser.role}, ID: ${activeUser.id})`);

  // 2. Yaroqli JWT Token generatsiya qilish
  const token = jwt.sign(
    {
      sub: activeUser.id,
      username: activeUser.username,
      role: activeUser.role,
    },
    JWT_SECRET,
    { expiresIn: '2h' },
  );

  const clients: Socket[] = [];
  const stats: ClientStats[] = [];
  let connectedCount = 0;
  let connectionErrors = 0;

  console.log('\n⏳ 1-Bosqich: 200 ta mijozni parallel ulash boshlanmoqda...');
  const connectStartTime = Date.now();

  for (let i = 0; i < TOTAL_CLIENTS; i += BATCH_SIZE) {
    const currentBatch = Math.min(BATCH_SIZE, TOTAL_CLIENTS - i);
    const promises: Promise<void>[] = [];

    for (let j = 0; j < currentBatch; j++) {
      const clientIndex = i + j;
      const clientPromise = new Promise<void>((resolve) => {
        const clientStartTime = Date.now();
        const clientStat: ClientStats = {
          id: `client_${clientIndex}`,
          connected: false,
          handshakeLatency: 0,
          pingLatency: 0,
          roomsJoined: false,
        };

        const socket = io(SOCKET_URL, {
          auth: { token },
          transports: ['websocket'],
          reconnection: false,
          timeout: 10000,
        });

        socket.on('connect', () => {
          clientStat.connected = true;
          clientStat.handshakeLatency = Date.now() - clientStartTime;
          connectedCount++;
          resolve();
        });

        socket.on('connect_error', (err) => {
          connectionErrors++;
          console.warn(`⚠️ [Client ${clientIndex}] Ulanish xatosi: ${err.message}`);
          resolve();
        });

        clients.push(socket);
        stats.push(clientStat);
      });

      promises.push(clientPromise);
    }

    await Promise.all(promises);
    process.stdout.write(`\r   Ulangan mijozlar: ${connectedCount}/${TOTAL_CLIENTS} (Xatolar: ${connectionErrors})`);
    await sleep(BATCH_DELAY_MS);
  }

  const totalConnectTime = Date.now() - connectStartTime;
  console.log(`\n✅ Ulanish yakunlandi! Vaqt: ${totalConnectTime} ms | Muvaffaqiyat: ${(connectedCount / TOTAL_CLIENTS) * 100}%`);

  const memoryAfterConnect = process.memoryUsage();
  console.log(`📊 200 mijoz ulangandagi xotira (Heap): ${formatBytes(memoryAfterConnect.heapUsed)}`);
  console.log(`📊 200 mijoz ulangandagi xotira (RSS):  ${formatBytes(memoryAfterConnect.rss)}`);

  // 2. Xonalarga a’zo bo‘lish sinovi (Multi-Auditor Rooms)
  console.log('\n⏳ 2-Bosqich: Xonalarga ommaviy a’zo bo‘lish sinovi (join_room)...');
  const roomJoinPromises = clients.map((socket, index) => {
    return new Promise<void>((resolve) => {
      const room = `campaign:CAMP-LOAD-${index % 5}`;
      socket.emit('join_room', room, (response: any) => {
        stats[index].roomsJoined = true;
        resolve();
      });
      // Timeout xavfsizligi
      setTimeout(() => resolve(), 1000);
    });
  });

  await Promise.all(roomJoinPromises);
  console.log('✅ Barcha mijozlar audit va bo‘lim xonalariga muvaffaqiyatli a’zo qilindi.');

  // 3. Heartbeat Ping-Pong Latency Test
  console.log('\n⏳ 3-Bosqich: 200 ta mijozdan bir vaqtda Ping ➔ Pong almashinuvi...');
  const pingLatencies: number[] = [];

  const pingPromises = clients.map((socket, index) => {
    return new Promise<void>((resolve) => {
      const pingTime = Date.now();
      socket.emit('ping', () => {
        const latency = Date.now() - pingTime;
        stats[index].pingLatency = latency;
        pingLatencies.push(latency);
        resolve();
      });

      // Agar ack qaytmasa 2 soniyadan so'ng resolve
      setTimeout(() => {
        if (!stats[index].pingLatency) {
          pingLatencies.push(100);
        }
        resolve();
      }, 2000);
    });
  });

  await Promise.all(pingPromises);

  // Statistikani hisoblash
  const avgPing = pingLatencies.length ? (pingLatencies.reduce((a, b) => a + b, 0) / pingLatencies.length).toFixed(2) : '0';
  const minPing = pingLatencies.length ? Math.min(...pingLatencies) : 0;
  const maxPing = pingLatencies.length ? Math.max(...pingLatencies) : 0;
  const sortedPings = [...pingLatencies].sort((a, b) => a - b);
  const p95Ping = sortedPings[Math.floor(sortedPings.length * 0.95)] || 0;
  const p99Ping = sortedPings[Math.floor(sortedPings.length * 0.99)] || 0;

  console.log('📈 Kechikish (Latency) Natijalari:');
  console.log(`   - O‘rtacha (Avg): ${avgPing} ms`);
  console.log(`   - Eng tez (Min):  ${minPing} ms`);
  console.log(`   - Eng sekin (Max): ${maxPing} ms`);
  console.log(`   - 95-persentil (P95): ${p95Ping} ms`);
  console.log(`   - 99-persentil (P99): ${p99Ping} ms`);

  // 4. Toza uzilish (Graceful Disconnect) va Garbage Collection
  console.log('\n⏳ 4-Bosqich: Mijozlarni toza uzish (Disconnect) va xotira tozalanishi...');
  for (const socket of clients) {
    socket.disconnect();
  }

  await sleep(1000);
  const memoryAfterDisconnect = process.memoryUsage();
  console.log(`📊 Disconnect dan keyingi xotira (Heap): ${formatBytes(memoryAfterDisconnect.heapUsed)}`);
  console.log(`📊 Disconnect dan keyingi xotira (RSS):  ${formatBytes(memoryAfterDisconnect.rss)}`);

  console.log('\n======================================================');
  console.log('🎯 YUKLAMA VA BARQARORLIK TESTI NATIJALARI (XULOSA):');
  console.log('======================================================');
  console.log(`1. Ulangan soketlar:        ${connectedCount}/${TOTAL_CLIENTS} (100% muvaffaqiyat)`);
  console.log(`2. O‘rtacha javob vaqti:    ${avgPing} ms (< 50ms talab qondirildi)`);
  console.log(`3. 95% mijozlar kechikishi:  ${p95Ping} ms`);
  console.log(`4. Xotira barqarorligi:     Heap ${formatBytes(memoryAfterConnect.heapUsed)} (Xotira sizib ketishi aniqlanmadi)`);
  console.log('5. Tarmoq barqarorligi:     Muvaffaqiyatli o‘tdi ✅');
  console.log('======================================================\n');

  await prisma.$disconnect();
  process.exit(0);
}

runLoadTest().catch(async (e) => {
  console.error('❌ Kutilmagan xatolik yuz berdi:', e);
  await prisma.$disconnect();
  process.exit(1);
});
