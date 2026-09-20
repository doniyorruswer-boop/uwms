import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Buildings and Rooms Backfill ---');

  // 1. Initial Buildings data
  const defaultBuildings = [
    { name: 'Bosh ma’muriy bino', code: 'BMB', floorsCount: 4, address: 'Universitet ko‘chasi, 1-bino', description: 'Rektorat va ma’muriyat binosi' },
    { name: 'Bosh bino', code: 'BB', floorsCount: 4, address: 'Universitet ko‘chasi, 1-bino', description: 'Universitet bosh o‘quv binosi' },
    { name: 'Bosh o‘quv binosi', code: 'BOB', floorsCount: 5, address: 'Universitet ko‘chasi, 2-bino', description: 'Bosh o‘quv korpusi' },
    { name: 'IT Bino', code: 'IT', floorsCount: 6, address: 'Innovatsiya ko‘chasi, 4-bino', description: 'Axborot texnologiyalari va dasturiy injiniring korpusi' },
    { name: 'Iqtisodiyot binosi', code: 'IQ', floorsCount: 4, address: 'Iqtisodchilar ko‘chasi, 7-bino', description: 'Raqamli iqtisodiyot va moliya binosi' },
    { name: 'Tabiiy fanlar korpusi', code: 'TFK', floorsCount: 4, address: 'Laboratoriyalar xiyoboni, 3-bino', description: 'Fizika, kimyo va biologiya laboratoriyalari binosi' },
    { name: 'Kutubxona binosi', code: 'ARM', floorsCount: 3, address: 'Ma’rifat maydoni, 1-bino', description: 'Axborot-resurs markazi va elektron kutubxona' },
  ];

  const buildingMap = new Map<string, string>();

  for (const b of defaultBuildings) {
    const record = await prisma.building.upsert({
      where: { name: b.name },
      update: {
        code: b.code,
        floorsCount: b.floorsCount,
        address: b.address,
        description: b.description,
      },
      create: {
        name: b.name,
        code: b.code,
        floorsCount: b.floorsCount,
        address: b.address,
        description: b.description,
      },
    });
    buildingMap.set(b.name, record.id);
    console.log(`Building synced: ${record.name} (${record.code}) -> ID: ${record.id}`);
  }

  // 2. Link all existing rooms to their buildings
  const rooms = await prisma.room.findMany();
  console.log(`Found ${rooms.length} rooms to verify and link...`);

  let updatedCount = 0;
  for (const room of rooms) {
    const buildingName = room.building || 'Bosh bino';
    let buildingId = buildingMap.get(buildingName);

    if (!buildingId) {
      // If an unknown building string exists, create it automatically
      const newBuilding = await prisma.building.upsert({
        where: { name: buildingName },
        update: {},
        create: {
          name: buildingName,
          code: buildingName.slice(0, 4).toUpperCase(),
          floorsCount: Math.max(room.floor, 4),
        },
      });
      buildingMap.set(buildingName, newBuilding.id);
      buildingId = newBuilding.id;
    }

    if (room.buildingId !== buildingId) {
      await prisma.room.update({
        where: { id: room.id },
        data: { buildingId },
      });
      updatedCount++;
    }
  }
  console.log(`Updated ${updatedCount} rooms with buildingId!`);

  // 3. Link existing warehouses to buildings
  const warehouses = await prisma.warehouse.findMany();
  for (const wh of warehouses) {
    const mainBuilding = buildingMap.get('Bosh ma’muriy bino') || buildingMap.get('Bosh bino');
    await prisma.warehouse.update({
      where: { id: wh.id },
      data: {
        code: wh.code || (wh.isMain ? 'WH-MAIN' : 'WH-SEC'),
        buildingId: wh.buildingId || mainBuilding,
      },
    });
    console.log(`Warehouse synced: ${wh.name} -> Code: ${wh.code || (wh.isMain ? 'WH-MAIN' : 'WH-SEC')}`);
  }

  console.log('--- Backfill completed successfully! ---');
}

main()
  .catch((e) => {
    console.error('Backfill error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
