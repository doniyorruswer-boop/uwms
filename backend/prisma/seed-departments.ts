import { PrismaClient } from '@prisma/client';
import {
  NAMDTU_FACULTIES,
  NAMDTU_CHAIRS,
  NAMDTU_CENTERS,
  NAMDTU_ADMIN_DEPARTMENTS,
} from './namdtu-structure';

export async function seedNamDTUDepartments(prisma: PrismaClient) {
  console.log('--- [UWMS] Seeding 100% Real NamDTU Organizational Hierarchy ---');

  // 1. Fakultetlar (8 ta)
  const facultyMap = new Map<string, any>();
  for (const fac of NAMDTU_FACULTIES) {
    const record = await prisma.department.upsert({
      where: { code: fac.code },
      update: { name: fac.name, type: 'FACULTY' },
      create: {
        code: fac.code,
        name: fac.name,
        type: 'FACULTY',
      },
    });
    facultyMap.set(fac.code, record);
  }

  // 2. Kafedralar (36 ta - har biri o'zining fakultetiga bog'langan)
  const chairMap = new Map<string, any>();
  for (const chair of NAMDTU_CHAIRS) {
    const parentFaculty = facultyMap.get(chair.facultyCode);
    const record = await prisma.department.upsert({
      where: { code: chair.code },
      update: {
        name: chair.name,
        type: 'CHAIR',
        parentId: parentFaculty?.id ?? null,
      },
      create: {
        code: chair.code,
        name: chair.name,
        type: 'CHAIR',
        parentId: parentFaculty?.id ?? null,
      },
    });
    chairMap.set(chair.code, record);
  }

  // 3. Markazlar (4 ta)
  const centerMap = new Map<string, any>();
  for (const center of NAMDTU_CENTERS) {
    const record = await prisma.department.upsert({
      where: { code: center.code },
      update: { name: center.name, type: center.type },
      create: {
        code: center.code,
        name: center.name,
        type: center.type,
      },
    });
    centerMap.set(center.code, record);
  }

  // 4. Ma'muriy Bo'limlar va Boshqarmalar (21 ta)
  const adminDeptMap = new Map<string, any>();
  for (const adm of NAMDTU_ADMIN_DEPARTMENTS) {
    const record = await prisma.department.upsert({
      where: { code: adm.code },
      update: { name: adm.name, type: adm.type },
      create: {
        code: adm.code,
        name: adm.name,
        type: adm.type,
      },
    });
    adminDeptMap.set(adm.code, record);
  }

  // Legacy mappings for safe reassignment from previous dev seeds
  const legacyMappings: Record<string, string> = {
    FAC_IT: 'FAC_AXBOROT_TEXNOLOGIYALARI',
    DEP_CS: 'KAF_AXBOROT_TIZIMLARI_VA_TEXNOLOGIYALARI',
    DEP_AI: 'KAF_RAQAMLAR_TEXNOLOGIYALAR',
    DEP_NET: 'KAF_AXBOROT_TIZIMLARI_VA_TEXNOLOGIYALARI',
    FAC_ECON: 'FAC_IQTISODIYOT',
    DEP_FIN: 'KAF_BUXGALTERIYA_HISOBI',
    IT_FACULTY: 'FAC_AXBOROT_TEXNOLOGIYALARI',
    SE_CHAIR: 'KAF_AXBOROT_TIZIMLARI_VA_TEXNOLOGIYALARI',
    CYBER_CHAIR: 'KAF_RAQAMLAR_TEXNOLOGIYALAR',
    AI_CHAIR: 'KAF_CHIZMA_GEOMETRIYA_GRAFIKA',
    ACC_CHAIR: 'KAF_BUXGALTERIYA_HISOBI',
    FIN_CHAIR: 'KAF_IQTISODIYOT',
    MATH_CHAIR: 'KAF_OLIY_MATEMATIKA',
    PHYS_CHAIR: 'KAF_FIZIKA',
    CHEM_CHAIR: 'KAF_KIMYO',
    BUXGALTERIYA: 'BOLIM_BUXGALTERIYA',
    ATM_CENTER: 'MARKAZ_RAQAMLI_TALIM_TEXNOLOGIYALARI',
    KADRLAR: 'BOLIM_XODIMLAR',
    DEVONXONA: 'BOLIM_DEVOXNXONA',
    XOJALIK: 'BOLIM_XOJALIK',
    ARM_LIBRARY: 'MARKAZ_AXBOROT_RESURS',
    ECON_FACULTY: 'FAC_BIZNESNI_BOSHQARISH',
    SCIENCE_FACULTY: 'FAC_YASHIL_TRANSFORMATSIYA',
  };

  for (const [oldCode, newCode] of Object.entries(legacyMappings)) {
    const oldDept = await prisma.department.findUnique({ where: { code: oldCode } });
    const targetDept =
      facultyMap.get(newCode) ||
      chairMap.get(newCode) ||
      centerMap.get(newCode) ||
      adminDeptMap.get(newCode);

    if (oldDept && targetDept && oldDept.id !== targetDept.id) {
      // Re-assign users
      await prisma.user.updateMany({
        where: { departmentId: oldDept.id },
        data: { departmentId: targetDept.id },
      });
      // Re-assign rooms
      await prisma.room.updateMany({
        where: { departmentId: oldDept.id },
        data: { departmentId: targetDept.id },
      });
      // Re-assign requests
      await prisma.request.updateMany({
        where: { departmentId: oldDept.id },
        data: { departmentId: targetDept.id },
      });
      // Re-assign quotas
      await prisma.departmentQuota.updateMany({
        where: { departmentId: oldDept.id },
        data: { departmentId: targetDept.id },
      });
      // Re-assign children
      await prisma.department.updateMany({
        where: { parentId: oldDept.id },
        data: { parentId: targetDept.id },
      });
      // Safely delete old department
      try {
        await prisma.department.delete({ where: { id: oldDept.id } });
      } catch (e) {
        // Ignored if relation constraints exist
      }
    }
  }

  // Delete stray/empty test departments
  const strays = await prisma.department.findMany({
    where: {
      OR: [
        { code: null },
        { name: 's' },
        { name: 'ATM' },
      ],
    },
    include: { _count: { select: { users: true, rooms: true, requests: true, children: true } } },
  });
  for (const s of strays) {
    if (s._count.users === 0 && s._count.rooms === 0 && s._count.requests === 0 && s._count.children === 0) {
      try {
        await prisma.department.delete({ where: { id: s.id } });
      } catch (e) {}
    }
  }

  console.log(
    `✅ Successfully seeded ${facultyMap.size} faculties, ${chairMap.size} chairs, ${centerMap.size} centers, and ${adminDeptMap.size} admin departments.`,
  );

  return {
    faculties: facultyMap,
    chairs: chairMap,
    centers: centerMap,
    adminDepartments: adminDeptMap,

    itFaculty: facultyMap.get('FAC_AXBOROT_TEXNOLOGIYALARI')!,
    econFaculty: facultyMap.get('FAC_BIZNESNI_BOSHQARISH')!,
    scienceFaculty: facultyMap.get('FAC_YASHIL_TRANSFORMATSIYA')!,

    seChair: chairMap.get('KAF_AXBOROT_TIZIMLARI_VA_TEXNOLOGIYALARI')!,
    cyberChair: chairMap.get('KAF_RAQAMLAR_TEXNOLOGIYALAR')!,
    aiChair: chairMap.get('KAF_CHIZMA_GEOMETRIYA_GRAFIKA')!,
    accChair: chairMap.get('KAF_BUXGALTERIYA_HISOBI')!,
    finChair: chairMap.get('KAF_IQTISODIYOT')!,
    mathChair: chairMap.get('KAF_OLIY_MATEMATIKA')!,
    physChair: chairMap.get('KAF_FIZIKA')!,
    chemChair: chairMap.get('KAF_KIMYO')!,

    rectorate: adminDeptMap.get('REKTORAT')!,
    accountingDept: adminDeptMap.get('BOLIM_BUXGALTERIYA')!,
    itCenter: centerMap.get('MARKAZ_RAQAMLI_TALIM_TEXNOLOGIYALARI')!,
    hrDept: adminDeptMap.get('BOLIM_XODIMLAR')!,
    chancelleryDept: adminDeptMap.get('BOLIM_DEVOXNXONA')!,
    facilitiesDept: adminDeptMap.get('BOLIM_XOJALIK')!,
    libraryDept: centerMap.get('MARKAZ_AXBOROT_RESURS')!,
  };
}
