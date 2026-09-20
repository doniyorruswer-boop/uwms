import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fixing department types and parent relationships...');

  const itFaculty = await prisma.department.findFirst({
    where: { code: 'IT_FACULTY' },
  });
  const econFaculty = await prisma.department.findFirst({
    where: { code: 'ECON_FACULTY' },
  });

  if (!itFaculty || !econFaculty) {
    console.error('Faculties not found!');
    return;
  }

  // 1. Sun'iy Intellekt va Kiberxavfsizlik Kafedrasi
  await prisma.department.updateMany({
    where: { name: { contains: 'Sun’iy Intellekt va Kiberxavfsizlik' } },
    data: { type: 'CHAIR', parentId: itFaculty.id },
  });

  // 2. Tarmoq Texnologiyalari va Telekommunikatsiya Kafedrasi
  await prisma.department.updateMany({
    where: { name: { contains: 'Tarmoq Texnologiyalari' } },
    data: { type: 'CHAIR', parentId: itFaculty.id },
  });

  // 3. Moliya va Buxgalteriya Hisobi Kafedrasi
  await prisma.department.updateMany({
    where: { name: { contains: 'Moliya va Buxgalteriya Hisobi' } },
    data: { type: 'CHAIR', parentId: econFaculty.id },
  });

  // 4. Any department containing "Kafedra" should have type: 'CHAIR'
  const allChairs = await prisma.department.findMany({
    where: {
      name: { contains: 'Kafedra' },
      type: { not: 'CHAIR' },
    },
  });
  for (const c of allChairs) {
    console.log(`Setting type CHAIR for ${c.name} (was ${c.type})`);
    await prisma.department.update({
      where: { id: c.id },
      data: { type: 'CHAIR', parentId: c.parentId || itFaculty.id },
    });
  }

  // 5. Connect room 101 to canonical Dasturiy Injiniring Kafedrasi
  const canonicalSeChair = await prisma.department.findFirst({
    where: { code: 'SE_CHAIR' },
  });
  if (canonicalSeChair) {
    await prisma.room.updateMany({
      where: {
        number: '101',
        department: { name: { contains: 'Dasturiy Injiniring' } },
      },
      data: { departmentId: canonicalSeChair.id },
    });

    // Assign unassigned test rooms in Bosh bino
    await prisma.room.updateMany({
      where: {
        departmentId: null,
        buildingRelation: { name: 'Bosh bino' },
      },
      data: { departmentId: canonicalSeChair.id },
    });
  }

  // Delete duplicate Dasturiy Injiniring if empty
  const duplicateSe = await prisma.department.findFirst({
    where: {
      id: '4bbf3684-f578-4aff-b1c9-eb0c82257276',
    },
    include: { rooms: true, users: true },
  });
  if (duplicateSe && duplicateSe.rooms.length === 0 && duplicateSe.users.length === 0) {
    await prisma.department.delete({ where: { id: duplicateSe.id } });
    console.log('Cleaned up duplicate department 4bbf3684');
  }

  console.log('Department hierarchy data fix completed successfully!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
