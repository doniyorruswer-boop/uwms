import {
  PrismaClient,
  RoleType,
  ItemType,
  AssetStatus,
  RequestStatus,
  RepairStatus,
  WriteOffStatus,
  VoteStatus,
  AuditStatus,
  AuditRecordStatus,
  NotificationType,
  BackupType,
  BackupStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding comprehensive university inventory database...');

  const passwordHash = await bcrypt.hash('admin123', 10);

  // Helper functions for safe idempotency
  async function getOrCreateRoom(data: {
    number: string;
    name: string;
    floor: number;
    building: string;
    departmentId?: string;
    responsibleUserId?: string;
  }) {
    const buildingRecord = await prisma.building.upsert({
      where: { name: data.building },
      update: {},
      create: {
        name: data.building,
        code: data.building.slice(0, 4).toUpperCase(),
        floorsCount: Math.max(data.floor, 4),
      },
    });

    const existing = await prisma.room.findFirst({
      where: { number: data.number, buildingId: buildingRecord.id },
    });
    if (existing) {
      return prisma.room.update({
        where: { id: existing.id },
        data: { ...data, buildingId: buildingRecord.id },
      });
    }
    return prisma.room.create({ data: { ...data, buildingId: buildingRecord.id } });
  }

  async function getOrCreateSupplier(data: {
    name: string;
    inn?: string;
    contractNumber?: string;
    contractDate?: Date;
    contactPerson?: string;
    phone?: string;
    email?: string;
    notes?: string;
  }) {
    const existing = await prisma.supplier.findFirst({
      where: { name: data.name },
    });
    if (existing) {
      return prisma.supplier.update({
        where: { id: existing.id },
        data,
      });
    }
    return prisma.supplier.create({ data });
  }

  async function getOrCreateWarehouse(data: { name: string; location?: string; isMain: boolean }) {
    const existing = await prisma.warehouse.findFirst({
      where: { name: data.name },
    });
    if (existing) {
      return prisma.warehouse.update({
        where: { id: existing.id },
        data,
      });
    }
    return prisma.warehouse.create({ data });
  }

  async function getOrCreateDepartmentQuota(data: {
    departmentId: string;
    itemId: string;
    period: string;
    monthlyLimit: number;
    usedQuantity: number;
    notes?: string | null;
  }) {
    return prisma.departmentQuota.upsert({
      where: {
        departmentId_itemId_period: {
          departmentId: data.departmentId,
          itemId: data.itemId,
          period: data.period,
        },
      },
      update: {
        monthlyLimit: data.monthlyLimit,
        usedQuantity: data.usedQuantity,
        notes: data.notes,
      },
      create: data,
    });
  }

  async function getOrCreateRequest(data: {
    requestNumber: string;
    purpose: string;
    status: RequestStatus;
    isOverQuota?: boolean;
    specialApprovalNeeded?: boolean;
    notes?: string | null;
    approvalNote?: string | null;
    requesterId: string;
    departmentId?: string | null;
    approvedById?: string | null;
    createdAt: Date;
    items: {
      itemId: string;
      requestedQty: number;
      approvedQty?: number | null;
    }[];
  }) {
    const existing = await prisma.request.findUnique({
      where: { requestNumber: data.requestNumber },
    });

    if (existing) {
      await prisma.requestItem.deleteMany({ where: { requestId: existing.id } });
      return prisma.request.update({
        where: { id: existing.id },
        data: {
          purpose: data.purpose,
          status: data.status,
          isOverQuota: data.isOverQuota ?? false,
          specialApprovalNeeded: data.specialApprovalNeeded ?? false,
          notes: data.notes,
          approvalNote: data.approvalNote,
          requesterId: data.requesterId,
          departmentId: data.departmentId,
          approvedById: data.approvedById,
          createdAt: data.createdAt,
          items: {
            create: data.items.map((i) => ({
              itemId: i.itemId,
              requestedQty: i.requestedQty,
              approvedQty: i.approvedQty,
            })),
          },
        },
      });
    }

    return prisma.request.create({
      data: {
        requestNumber: data.requestNumber,
        purpose: data.purpose,
        status: data.status,
        isOverQuota: data.isOverQuota ?? false,
        specialApprovalNeeded: data.specialApprovalNeeded ?? false,
        notes: data.notes,
        approvalNote: data.approvalNote,
        requesterId: data.requesterId,
        departmentId: data.departmentId,
        approvedById: data.approvedById,
        createdAt: data.createdAt,
        items: {
          create: data.items.map((i) => ({
            itemId: i.itemId,
            requestedQty: i.requestedQty,
            approvedQty: i.approvedQty,
          })),
        },
      },
    });
  }

  async function getOrCreateRepairRecord(data: {
    repairNumber: string;
    assetId: string;
    issueDescription: string;
    status: RepairStatus;
    serviceProvider?: string | null;
    cost?: number | null;
    startDate?: Date | null;
    completionDate?: Date | null;
    actNumber?: string | null;
    notes?: string | null;
    requestedById: string;
    approvedById?: string | null;
    createdAt: Date;
  }) {
    const existing = await prisma.repairRecord.findUnique({
      where: { repairNumber: data.repairNumber },
    });
    if (existing) {
      return prisma.repairRecord.update({
        where: { id: existing.id },
        data: {
          assetId: data.assetId,
          issueDescription: data.issueDescription,
          status: data.status,
          serviceProvider: data.serviceProvider,
          cost: data.cost != null ? Number(data.cost) : null,
          startDate: data.startDate,
          completionDate: data.completionDate,
          actNumber: data.actNumber,
          notes: data.notes,
          requestedById: data.requestedById,
          approvedById: data.approvedById,
          createdAt: data.createdAt,
        },
      });
    }
    return prisma.repairRecord.create({
      data: {
        repairNumber: data.repairNumber,
        assetId: data.assetId,
        issueDescription: data.issueDescription,
        status: data.status,
        serviceProvider: data.serviceProvider,
        cost: data.cost != null ? Number(data.cost) : null,
        startDate: data.startDate,
        completionDate: data.completionDate,
        actNumber: data.actNumber,
        notes: data.notes,
        requestedById: data.requestedById,
        approvedById: data.approvedById,
        createdAt: data.createdAt,
      },
    });
  }

  async function getOrCreateWriteOffRequest(data: {
    actNumber: string;
    assetId: string;
    reason: string;
    technicalConclusion?: string | null;
    status: WriteOffStatus;
    approvedAt?: Date | null;
    createdById: string;
    createdAt: Date;
    members: {
      userId: string;
      roleName: string;
      vote: VoteStatus;
      comment?: string | null;
      votedAt?: Date | null;
    }[];
  }) {
    const existing = await prisma.writeOffRequest.findUnique({
      where: { actNumber: data.actNumber },
    });

    if (existing) {
      await prisma.writeOffMemberVote.deleteMany({ where: { writeOffId: existing.id } });
      return prisma.writeOffRequest.update({
        where: { id: existing.id },
        data: {
          assetId: data.assetId,
          reason: data.reason,
          technicalConclusion: data.technicalConclusion,
          status: data.status,
          approvedAt: data.approvedAt,
          createdById: data.createdById,
          createdAt: data.createdAt,
          members: {
            create: data.members.map((m) => ({
              userId: m.userId,
              roleName: m.roleName,
              vote: m.vote,
              comment: m.comment,
              votedAt: m.votedAt,
            })),
          },
        },
      });
    }

    return prisma.writeOffRequest.create({
      data: {
        actNumber: data.actNumber,
        assetId: data.assetId,
        reason: data.reason,
        technicalConclusion: data.technicalConclusion,
        status: data.status,
        approvedAt: data.approvedAt,
        createdById: data.createdById,
        createdAt: data.createdAt,
        members: {
          create: data.members.map((m) => ({
            userId: m.userId,
            roleName: m.roleName,
            vote: m.vote,
            comment: m.comment,
            votedAt: m.votedAt,
          })),
        },
      },
    });
  }

  async function getOrCreateInventoryAudit(data: {
    auditNumber: string;
    title: string;
    status: AuditStatus;
    notes?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
    createdById: string;
    roomId?: string | null;
    records?: {
      itemInstanceId: string;
      expectedRoomId?: string | null;
      foundRoomId?: string | null;
      status: AuditRecordStatus;
      scannedAt: Date;
      notes?: string | null;
    }[];
  }) {
    const existing = await prisma.inventoryAudit.findUnique({
      where: { auditNumber: data.auditNumber },
    });
    if (existing) {
      if (data.records && data.records.length > 0) {
        await prisma.inventoryAuditRecord.deleteMany({ where: { auditId: existing.id } });
      }
      return prisma.inventoryAudit.update({
        where: { id: existing.id },
        data: {
          title: data.title,
          status: data.status,
          notes: data.notes,
          startedAt: data.startedAt,
          completedAt: data.completedAt,
          createdById: data.createdById,
          roomId: data.roomId,
          records: data.records
            ? {
                create: data.records.map((r) => ({
                  itemInstanceId: r.itemInstanceId,
                  expectedRoomId: r.expectedRoomId,
                  foundRoomId: r.foundRoomId,
                  status: r.status,
                  scannedAt: r.scannedAt,
                  notes: r.notes,
                })),
              }
            : undefined,
        },
      });
    }
    return prisma.inventoryAudit.create({
      data: {
        auditNumber: data.auditNumber,
        title: data.title,
        status: data.status,
        notes: data.notes,
        startedAt: data.startedAt,
        completedAt: data.completedAt,
        createdById: data.createdById,
        roomId: data.roomId,
        records: data.records
          ? {
              create: data.records.map((r) => ({
                itemInstanceId: r.itemInstanceId,
                expectedRoomId: r.expectedRoomId,
                foundRoomId: r.foundRoomId,
                status: r.status,
                scannedAt: r.scannedAt,
                notes: r.notes,
              })),
            }
          : undefined,
      },
    });
  }

  async function getOrCreateDocumentStamp(data: {
    docType: string;
    docNumber: string;
    verificationHash: string;
    title: string;
    signerName: string;
    signerRole: string;
    metadataJson: string;
    isValid?: boolean;
    createdAt: Date;
  }) {
    return prisma.documentStamp.upsert({
      where: { docNumber: data.docNumber },
      update: {
        title: data.title,
        verificationHash: data.verificationHash,
        signerName: data.signerName,
        signerRole: data.signerRole,
        metadataJson: data.metadataJson,
        isValid: data.isValid ?? true,
      },
      create: {
        docType: data.docType,
        docNumber: data.docNumber,
        verificationHash: data.verificationHash,
        title: data.title,
        signerName: data.signerName,
        signerRole: data.signerRole,
        metadataJson: data.metadataJson,
        isValid: data.isValid ?? true,
        createdAt: data.createdAt,
      },
    });
  }

  async function getOrCreateBackupRecord(data: {
    filename: string;
    filePath: string;
    fileSizeBytes: bigint;
    backupType: BackupType;
    status: BackupStatus;
    checksum?: string | null;
    notes?: string | null;
    triggeredById?: string | null;
    createdAt: Date;
    completedAt?: Date | null;
  }) {
    const existing = await prisma.backupRecord.findFirst({
      where: { filename: data.filename },
    });
    if (existing) {
      return prisma.backupRecord.update({
        where: { id: existing.id },
        data,
      });
    }
    return prisma.backupRecord.create({ data });
  }

  async function getOrCreateNotification(data: {
    userId: string;
    title: string;
    message: string;
    type: NotificationType;
    link?: string | null;
    isRead?: boolean;
    createdAt: Date;
  }) {
    const existing = await prisma.notification.findFirst({
      where: { userId: data.userId, title: data.title },
    });
    if (existing) {
      return prisma.notification.update({
        where: { id: existing.id },
        data,
      });
    }
    return prisma.notification.create({ data });
  }

  // =========================================================================
  // 1. TASHKILIY TUZILMA (FAKULTETLAR, KAFEDRALAR VA BO'LIMLAR)
  // =========================================================================
  console.log('1. Seeding faculties, departments and administration...');

  // 1.1 Fakultetlar
  const itFaculty = await prisma.department.upsert({
    where: { code: 'IT_FACULTY' },
    update: { name: 'Kompyuter Injiniringi Fakulteti', type: 'FACULTY' },
    create: {
      name: 'Kompyuter Injiniringi Fakulteti',
      code: 'IT_FACULTY',
      type: 'FACULTY',
    },
  });

  const econFaculty = await prisma.department.upsert({
    where: { code: 'ECON_FACULTY' },
    update: { name: 'Raqamli Iqtisodiyot va Moliya Fakulteti', type: 'FACULTY' },
    create: {
      name: 'Raqamli Iqtisodiyot va Moliya Fakulteti',
      code: 'ECON_FACULTY',
      type: 'FACULTY',
    },
  });

  const scienceFaculty = await prisma.department.upsert({
    where: { code: 'SCIENCE_FACULTY' },
    update: { name: 'Tabiiy va Aniq Fanlar Fakulteti', type: 'FACULTY' },
    create: {
      name: 'Tabiiy va Aniq Fanlar Fakulteti',
      code: 'SCIENCE_FACULTY',
      type: 'FACULTY',
    },
  });

  // 1.2 Kafedralar
  const seChair = await prisma.department.upsert({
    where: { code: 'SE_CHAIR' },
    update: { name: 'Dasturiy Injiniring Kafedrasi', parentId: itFaculty.id },
    create: {
      name: 'Dasturiy Injiniring Kafedrasi',
      code: 'SE_CHAIR',
      type: 'CHAIR',
      parentId: itFaculty.id,
    },
  });

  const cyberChair = await prisma.department.upsert({
    where: { code: 'CYBER_CHAIR' },
    update: { name: 'Kiberxavfsizlik Kafedrasi', parentId: itFaculty.id },
    create: {
      name: 'Kiberxavfsizlik Kafedrasi',
      code: 'CYBER_CHAIR',
      type: 'CHAIR',
      parentId: itFaculty.id,
    },
  });

  const aiChair = await prisma.department.upsert({
    where: { code: 'AI_CHAIR' },
    update: { name: 'Sun’iy Intellekt va Katta Ma’lumotlar Kafedrasi', parentId: itFaculty.id },
    create: {
      name: 'Sun’iy Intellekt va Katta Ma’lumotlar Kafedrasi',
      code: 'AI_CHAIR',
      type: 'CHAIR',
      parentId: itFaculty.id,
    },
  });

  const accChair = await prisma.department.upsert({
    where: { code: 'ACC_CHAIR' },
    update: { name: 'Buxgalteriya Hisobi va Audit Kafedrasi', parentId: econFaculty.id },
    create: {
      name: 'Buxgalteriya Hisobi va Audit Kafedrasi',
      code: 'ACC_CHAIR',
      type: 'CHAIR',
      parentId: econFaculty.id,
    },
  });

  const finChair = await prisma.department.upsert({
    where: { code: 'FIN_CHAIR' },
    update: { name: 'Moliya va Bank Ishi Kafedrasi', parentId: econFaculty.id },
    create: {
      name: 'Moliya va Bank Ishi Kafedrasi',
      code: 'FIN_CHAIR',
      type: 'CHAIR',
      parentId: econFaculty.id,
    },
  });

  const mathChair = await prisma.department.upsert({
    where: { code: 'MATH_CHAIR' },
    update: { name: 'Oliy Matematika va Matematik Modellashtirish Kafedrasi', parentId: scienceFaculty.id },
    create: {
      name: 'Oliy Matematika va Matematik Modellashtirish Kafedrasi',
      code: 'MATH_CHAIR',
      type: 'CHAIR',
      parentId: scienceFaculty.id,
    },
  });

  const physChair = await prisma.department.upsert({
    where: { code: 'PHYS_CHAIR' },
    update: { name: 'Umumiy Fizika va Yarimo‘tkazgichlar Kafedrasi', parentId: scienceFaculty.id },
    create: {
      name: 'Umumiy Fizika va Yarimo‘tkazgichlar Kafedrasi',
      code: 'PHYS_CHAIR',
      type: 'CHAIR',
      parentId: scienceFaculty.id,
    },
  });

  const chemChair = await prisma.department.upsert({
    where: { code: 'CHEM_CHAIR' },
    update: { name: 'Noorganik Kimyo va Ekologiya Kafedrasi', parentId: scienceFaculty.id },
    create: {
      name: 'Noorganik Kimyo va Ekologiya Kafedrasi',
      code: 'CHEM_CHAIR',
      type: 'CHAIR',
      parentId: scienceFaculty.id,
    },
  });

  // 1.3 Ma'muriy bo'limlar
  const rectorate = await prisma.department.upsert({
    where: { code: 'REKTORAT' },
    update: { name: 'Universitet Rektorati va Rahbariyat' },
    create: {
      name: 'Universitet Rektorati va Rahbariyat',
      code: 'REKTORAT',
      type: 'RECTORATE',
    },
  });

  const accountingDept = await prisma.department.upsert({
    where: { code: 'BUXGALTERIYA' },
    update: { name: 'Buxgalteriya va Moliya-iqtisodiyot bo‘limi' },
    create: {
      name: 'Buxgalteriya va Moliya-iqtisodiyot bo‘limi',
      code: 'BUXGALTERIYA',
      type: 'DEPARTMENT',
    },
  });

  const itCenter = await prisma.department.upsert({
    where: { code: 'ATM_CENTER' },
    update: { name: 'Axborot Texnologiyalari Markazi (ATM)' },
    create: {
      name: 'Axborot Texnologiyalari Markazi (ATM)',
      code: 'ATM_CENTER',
      type: 'DIVISION',
    },
  });

  const hrDept = await prisma.department.upsert({
    where: { code: 'KADRLAR' },
    update: { name: 'Inson Resurslari va Kadrlar bo‘limi' },
    create: {
      name: 'Inson Resurslari va Kadrlar bo‘limi',
      code: 'KADRLAR',
      type: 'DEPARTMENT',
    },
  });

  const chancelleryDept = await prisma.department.upsert({
    where: { code: 'DEVONXONA' },
    update: { name: 'Devonxona va Tashkiliy Nazorat bo‘limi' },
    create: {
      name: 'Devonxona va Tashkiliy Nazorat bo‘limi',
      code: 'DEVONXONA',
      type: 'DEPARTMENT',
    },
  });

  const facilitiesDept = await prisma.department.upsert({
    where: { code: 'XOJALIK' },
    update: { name: 'Xo‘jalik Bo‘limi va Komendantlik' },
    create: {
      name: 'Xo‘jalik Bo‘limi va Komendantlik',
      code: 'XOJALIK',
      type: 'DEPARTMENT',
    },
  });

  const libraryDept = await prisma.department.upsert({
    where: { code: 'ARM_LIBRARY' },
    update: { name: 'Axborot-Resurs Markazi (ARM / Kutubxona)' },
    create: {
      name: 'Axborot-Resurs Markazi (ARM / Kutubxona)',
      code: 'ARM_LIBRARY',
      type: 'LIBRARY',
    },
  });

  // =========================================================================
  // 2. FOYDALANUVCHILAR VA ROLLAR (RBAC)
  // =========================================================================
  console.log('2. Seeding users with roles...');

  // 2.1 Super Admin
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { password: passwordHash, isActive: true, role: RoleType.SUPER_ADMIN, departmentId: itCenter.id },
    create: {
      fullName: 'Bosh Administrator',
      username: 'admin',
      email: 'admin@university.uz',
      password: passwordHash,
      phone: '+998 71 200 00 01',
      position: 'Axborot texnologiyalari markazi boshlig‘i',
      role: RoleType.SUPER_ADMIN,
      departmentId: itCenter.id,
    },
  });

  // 2.2 Omborchilar
  const warehouseChief = await prisma.user.upsert({
    where: { username: 'omborchi' },
    update: { password: passwordHash, isActive: true, role: RoleType.HEAD_WAREHOUSE, departmentId: facilitiesDept.id },
    create: {
      fullName: 'Toshmatov Omon',
      username: 'omborchi',
      email: 'ombor@university.uz',
      password: passwordHash,
      phone: '+998 90 123 45 67',
      position: 'Bosh ombor mudiri',
      role: RoleType.HEAD_WAREHOUSE,
      departmentId: facilitiesDept.id,
    },
  });

  const warehouseAssistant = await prisma.user.upsert({
    where: { username: 'omborchi_yordamchi' },
    update: { password: passwordHash, isActive: true, role: RoleType.HEAD_WAREHOUSE, departmentId: facilitiesDept.id },
    create: {
      fullName: 'Ergashev Bobur',
      username: 'omborchi_yordamchi',
      email: 'bobur.ombor@university.uz',
      password: passwordHash,
      phone: '+998 91 234 56 78',
      position: 'Katta omborchi-ekspeditor',
      role: RoleType.HEAD_WAREHOUSE,
      departmentId: facilitiesDept.id,
    },
  });

  // 2.3 Kafedra Mudirlari (Moddiy Javobgar Shaxslar - MOL)
  const molHead = await prisma.user.upsert({
    where: { username: 'kafedra_mudiri' },
    update: { password: passwordHash, isActive: true, role: RoleType.MOL, departmentId: seChair.id },
    create: {
      fullName: 'Prof. Alimov Jasur',
      username: 'kafedra_mudiri',
      email: 'alimov@university.uz',
      password: passwordHash,
      phone: '+998 93 345 67 89',
      position: 'Dasturiy injiniring kafedrasi mudiri',
      role: RoleType.MOL,
      departmentId: seChair.id,
    },
  });

  const molCyber = await prisma.user.upsert({
    where: { username: 'mudir_kiber' },
    update: { password: passwordHash, isActive: true, role: RoleType.MOL, departmentId: cyberChair.id },
    create: {
      fullName: 'Dots. Qosimov Shuhrat',
      username: 'mudir_kiber',
      email: 'qosimov@university.uz',
      password: passwordHash,
      phone: '+998 94 456 78 90',
      position: 'Kiberxavfsizlik kafedrasi mudiri',
      role: RoleType.MOL,
      departmentId: cyberChair.id,
    },
  });

  const molAI = await prisma.user.upsert({
    where: { username: 'mudir_ai' },
    update: { password: passwordHash, isActive: true, role: RoleType.MOL, departmentId: aiChair.id },
    create: {
      fullName: 'Dr. Rahimov Aziz',
      username: 'mudir_ai',
      email: 'rahimov.ai@university.uz',
      password: passwordHash,
      phone: '+998 97 567 89 01',
      position: 'Sun’iy intellekt kafedrasi mudiri',
      role: RoleType.MOL,
      departmentId: aiChair.id,
    },
  });

  const molAcc = await prisma.user.upsert({
    where: { username: 'mudir_buxg' },
    update: { password: passwordHash, isActive: true, role: RoleType.MOL, departmentId: accChair.id },
    create: {
      fullName: 'Prof. Yoqubov Sardor',
      username: 'mudir_buxg',
      email: 'yoqubov@university.uz',
      password: passwordHash,
      phone: '+998 98 678 90 12',
      position: 'Buxgalteriya hisobi kafedrasi mudiri',
      role: RoleType.MOL,
      departmentId: accChair.id,
    },
  });

  const molFin = await prisma.user.upsert({
    where: { username: 'mudir_moliya' },
    update: { password: passwordHash, isActive: true, role: RoleType.MOL, departmentId: finChair.id },
    create: {
      fullName: 'Dots. Vohidov Botir',
      username: 'mudir_moliya',
      email: 'vohidov@university.uz',
      password: passwordHash,
      phone: '+998 99 789 01 23',
      position: 'Moliya kafedrasi mudiri',
      role: RoleType.MOL,
      departmentId: finChair.id,
    },
  });

  const molMath = await prisma.user.upsert({
    where: { username: 'mudir_matematika' },
    update: { password: passwordHash, isActive: true, role: RoleType.MOL, departmentId: mathChair.id },
    create: {
      fullName: 'Dots. Karimov Olim',
      username: 'mudir_matematika',
      email: 'karimov.olim@university.uz',
      password: passwordHash,
      phone: '+998 90 890 12 34',
      position: 'Oliy matematika kafedrasi mudiri',
      role: RoleType.MOL,
      departmentId: mathChair.id,
    },
  });

  const molPhys = await prisma.user.upsert({
    where: { username: 'mudir_fizika' },
    update: { password: passwordHash, isActive: true, role: RoleType.MOL, departmentId: physChair.id },
    create: {
      fullName: 'Prof. Mahmudov Timur',
      username: 'mudir_fizika',
      email: 'mahmudov@university.uz',
      password: passwordHash,
      phone: '+998 91 901 23 45',
      position: 'Fizika kafedrasi mudiri',
      role: RoleType.MOL,
      departmentId: physChair.id,
    },
  });

  const molChem = await prisma.user.upsert({
    where: { username: 'mudir_kimyo' },
    update: { password: passwordHash, isActive: true, role: RoleType.MOL, departmentId: chemChair.id },
    create: {
      fullName: 'Dr. Sobirova Dilnoza',
      username: 'mudir_kimyo',
      email: 'sobirova@university.uz',
      password: passwordHash,
      phone: '+998 93 012 34 56',
      position: 'Kimyo kafedrasi mudiri',
      role: RoleType.MOL,
      departmentId: chemChair.id,
    },
  });

  // 2.4 O'qituvchilar va Xodimlar
  const employee = await prisma.user.upsert({
    where: { username: 'oqituvchi1' },
    update: { password: passwordHash, isActive: true, role: RoleType.EMPLOYEE, departmentId: seChair.id },
    create: {
      fullName: 'Karimov Rustam',
      username: 'oqituvchi1',
      email: 'karimov.rustam@university.uz',
      password: passwordHash,
      phone: '+998 90 222 33 44',
      position: 'Katta o‘qituvchi',
      role: RoleType.EMPLOYEE,
      departmentId: seChair.id,
    },
  });

  const teacher2 = await prisma.user.upsert({
    where: { username: 'oqituvchi2' },
    update: { password: passwordHash, isActive: true, role: RoleType.EMPLOYEE, departmentId: cyberChair.id },
    create: {
      fullName: 'Saidov Dilshod',
      username: 'oqituvchi2',
      email: 'saidov@university.uz',
      password: passwordHash,
      phone: '+998 93 333 44 55',
      position: 'Assistent o‘qituvchi',
      role: RoleType.EMPLOYEE,
      departmentId: cyberChair.id,
    },
  });

  const laborant1 = await prisma.user.upsert({
    where: { username: 'katta_laborant' },
    update: { password: passwordHash, isActive: true, role: RoleType.EMPLOYEE, departmentId: aiChair.id },
    create: {
      fullName: 'Umarova Nigora',
      username: 'katta_laborant',
      email: 'umarova@university.uz',
      password: passwordHash,
      phone: '+998 94 444 55 66',
      position: 'Katta laborant',
      role: RoleType.EMPLOYEE,
      departmentId: aiChair.id,
    },
  });

  const docentValiyev = await prisma.user.upsert({
    where: { username: 'dotsent_valiyev' },
    update: { password: passwordHash, isActive: true, role: RoleType.EMPLOYEE, departmentId: accChair.id },
    create: {
      fullName: 'Dots. Valiyev Alisher',
      username: 'dotsent_valiyev',
      email: 'valiyev@university.uz',
      password: passwordHash,
      phone: '+998 97 777 88 99',
      position: 'Dotsent',
      role: RoleType.EMPLOYEE,
      departmentId: accChair.id,
    },
  });

  const assistentBekzod = await prisma.user.upsert({
    where: { username: 'assistent_bekzod' },
    update: { password: passwordHash, isActive: true, role: RoleType.EMPLOYEE, departmentId: physChair.id },
    create: {
      fullName: 'Rahmonov Bekzod',
      username: 'assistent_bekzod',
      email: 'rahmonov@university.uz',
      password: passwordHash,
      phone: '+998 99 999 00 11',
      position: 'Kabinet mudiri va assistent',
      role: RoleType.EMPLOYEE,
      departmentId: physChair.id,
    },
  });

  // 2.5 Ichki Auditorlar
  const auditor = await prisma.user.upsert({
    where: { username: 'auditor' },
    update: { password: passwordHash, isActive: true, role: RoleType.AUDITOR },
    create: {
      fullName: 'Narzullayev Farhod',
      username: 'auditor',
      email: 'audit@university.uz',
      password: passwordHash,
      phone: '+998 90 555 66 77',
      position: 'Ichki nazorat va audit inspektori',
      role: RoleType.AUDITOR,
    },
  });

  const chiefAuditor = await prisma.user.upsert({
    where: { username: 'auditor_katta' },
    update: { password: passwordHash, isActive: true, role: RoleType.AUDITOR },
    create: {
      fullName: 'Xolmatov Sanjar',
      username: 'auditor_katta',
      email: 'sanjar.audit@university.uz',
      password: passwordHash,
      phone: '+998 91 666 77 88',
      position: 'Bosh auditor',
      role: RoleType.AUDITOR,
    },
  });

  // 2.6 Moliya-iqtisodiyot Prorektori
  const viceRector = await prisma.user.upsert({
    where: { username: 'prorektor_moliya' },
    update: { password: passwordHash, isActive: true, role: RoleType.VICE_RECTOR_FINANCE, departmentId: rectorate.id },
    create: {
      fullName: 'Prof. Mahmudov Elyor',
      username: 'prorektor_moliya',
      email: 'elyor.prorektor@university.uz',
      password: passwordHash,
      phone: '+998 90 777 00 11',
      position: 'Moliya va iqtisodiy ishlar bo‘yicha prorektor',
      role: RoleType.VICE_RECTOR_FINANCE,
      departmentId: rectorate.id,
    },
  });

  // 2.7 Universitet Rektori
  const rector = await prisma.user.upsert({
    where: { username: 'rektor' },
    update: { password: passwordHash, isActive: true, role: RoleType.RECTOR, departmentId: rectorate.id },
    create: {
      fullName: 'Akad. Karimov O‘ktam',
      username: 'rektor',
      email: 'rector@university.uz',
      password: passwordHash,
      phone: '+998 71 200 00 00',
      position: 'Universitet Rektori',
      role: RoleType.RECTOR,
      departmentId: rectorate.id,
    },
  });

  // 2.8 Bosh Hisobchi
  const chiefAccountant = await prisma.user.upsert({
    where: { username: 'bosh_hisobchi' },
    update: { password: passwordHash, isActive: true, role: RoleType.CHIEF_ACCOUNTANT, departmentId: accountingDept.id },
    create: {
      fullName: 'Nazarova Munira',
      username: 'bosh_hisobchi',
      email: 'munira.hisobchi@university.uz',
      password: passwordHash,
      phone: '+998 93 888 99 00',
      position: 'Bosh hisobchi',
      role: RoleType.CHIEF_ACCOUNTANT,
      departmentId: accountingDept.id,
    },
  });

  // 2.9 Bino Komendanti
  const commendant = await prisma.user.upsert({
    where: { username: 'komendant' },
    update: { password: passwordHash, isActive: true, role: RoleType.COMMENDANT, departmentId: facilitiesDept.id },
    create: {
      fullName: 'Sodiqov Anvar',
      username: 'komendant',
      email: 'anvar.komendant@university.uz',
      password: passwordHash,
      phone: '+998 94 999 11 22',
      position: 'Bosh bino komendanti',
      role: RoleType.COMMENDANT,
      departmentId: facilitiesDept.id,
    },
  });

  // =========================================================================
  // 3. XONALAR VA AUDITORIYALAR (25 TA XONA)
  // =========================================================================
  console.log('3. Seeding 25 comprehensive university rooms...');

  // Bosh Ma'muriy Bino
  const room101 = await getOrCreateRoom({
    number: '101',
    name: 'Rektorat qabulxonasi va devonxona',
    floor: 1,
    building: 'Bosh ma’muriy bino',
    departmentId: rectorate.id,
    responsibleUserId: admin.id,
  });

  const room105 = await getOrCreateRoom({
    number: '105',
    name: 'Bosh hisobchi va buxgalteriya kabineti',
    floor: 1,
    building: 'Bosh ma’muriy bino',
    departmentId: accountingDept.id,
    responsibleUserId: admin.id,
  });

  const room108 = await getOrCreateRoom({
    number: '108',
    name: 'Inson resurslari va kadrlar bo‘limi',
    floor: 1,
    building: 'Bosh ma’muriy bino',
    departmentId: hrDept.id,
    responsibleUserId: admin.id,
  });

  const room110 = await getOrCreateRoom({
    number: '110',
    name: 'Xo‘jalik xizmati va komendantlik',
    floor: 1,
    building: 'Bosh ma’muriy bino',
    departmentId: facilitiesDept.id,
    responsibleUserId: warehouseChief.id,
  });

  const roomKonf = await getOrCreateRoom({
    number: 'KONF-1',
    name: 'Universitet bosh anjumanlar zali (Assembly Hall)',
    floor: 2,
    building: 'Bosh ma’muriy bino',
    departmentId: rectorate.id,
    responsibleUserId: admin.id,
  });

  // IT Bino
  const room301 = await getOrCreateRoom({
    number: '301',
    name: 'ATM Server va tarmoq boshqaruv xonasi',
    floor: 3,
    building: 'IT Bino',
    departmentId: itCenter.id,
    responsibleUserId: admin.id,
  });

  const room304 = await getOrCreateRoom({
    number: '304',
    name: 'Dasturiy injiniring o‘quv laboratoriyasi №1',
    floor: 3,
    building: 'IT Bino',
    departmentId: seChair.id,
    responsibleUserId: molHead.id,
  });

  const room305 = await getOrCreateRoom({
    number: '305',
    name: 'Dasturiy injiniring kafedra mudiri kabineti',
    floor: 3,
    building: 'IT Bino',
    departmentId: seChair.id,
    responsibleUserId: molHead.id,
  });

  const room306 = await getOrCreateRoom({
    number: '306',
    name: 'Dasturiy injiniring o‘qituvchilar xonasi',
    floor: 3,
    building: 'IT Bino',
    departmentId: seChair.id,
    responsibleUserId: molHead.id,
  });

  const room307 = await getOrCreateRoom({
    number: '307',
    name: 'Dasturiy injiniring o‘quv laboratoriyasi №2',
    floor: 3,
    building: 'IT Bino',
    departmentId: seChair.id,
    responsibleUserId: molHead.id,
  });

  const room401 = await getOrCreateRoom({
    number: '401',
    name: 'Kiberxavfsizlik maxsus tadqiqot laboratoriyasi',
    floor: 4,
    building: 'IT Bino',
    departmentId: cyberChair.id,
    responsibleUserId: molCyber.id,
  });

  const room402 = await getOrCreateRoom({
    number: '402',
    name: 'Kiberxavfsizlik kafedra mudiri kabineti',
    floor: 4,
    building: 'IT Bino',
    departmentId: cyberChair.id,
    responsibleUserId: molCyber.id,
  });

  const room405 = await getOrCreateRoom({
    number: '405',
    name: 'Sun’iy intellekt va neyrotarmoqlar ilmiy markazi',
    floor: 4,
    building: 'IT Bino',
    departmentId: aiChair.id,
    responsibleUserId: molAI.id,
  });

  const room406 = await getOrCreateRoom({
    number: '406',
    name: 'Sun’iy intellekt kafedra mudiri kabineti',
    floor: 4,
    building: 'IT Bino',
    departmentId: aiChair.id,
    responsibleUserId: molAI.id,
  });

  // Raqamli Iqtisodiyot va Moliya Binosi
  const room201 = await getOrCreateRoom({
    number: '201',
    name: 'Buxgalteriya hisobi kafedra mudiri kabineti',
    floor: 2,
    building: 'Iqtisodiyot binosi',
    departmentId: accChair.id,
    responsibleUserId: molAcc.id,
  });

  const room202 = await getOrCreateRoom({
    number: '202',
    name: '1C va Moliyaviy modellashtirish o‘quv zali',
    floor: 2,
    building: 'Iqtisodiyot binosi',
    departmentId: accChair.id,
    responsibleUserId: molAcc.id,
  });

  const room205 = await getOrCreateRoom({
    number: '205',
    name: 'Moliya va bank ishi kafedra mudiri kabineti',
    floor: 2,
    building: 'Iqtisodiyot binosi',
    departmentId: finChair.id,
    responsibleUserId: molFin.id,
  });

  const room206 = await getOrCreateRoom({
    number: '206',
    name: 'Raqamli bank ishi va ekonometrika o‘quv xonasi',
    floor: 2,
    building: 'Iqtisodiyot binosi',
    departmentId: finChair.id,
    responsibleUserId: molFin.id,
  });

  // Tabiiy Fanlar Korpusi
  const room112 = await getOrCreateRoom({
    number: '112',
    name: 'Oliy matematika va ilmiy hisoblashlar o‘quv zali',
    floor: 1,
    building: 'Tabiiy fanlar korpusi',
    departmentId: mathChair.id,
    responsibleUserId: molMath.id,
  });

  const room215 = await getOrCreateRoom({
    number: '215',
    name: 'Umumiy fizika va optika tajriba laboratoriyasi',
    floor: 2,
    building: 'Tabiiy fanlar korpusi',
    departmentId: physChair.id,
    responsibleUserId: molPhys.id,
  });

  const room216 = await getOrCreateRoom({
    number: '216',
    name: 'Fizika kafedra mudiri kabineti',
    floor: 2,
    building: 'Tabiiy fanlar korpusi',
    departmentId: physChair.id,
    responsibleUserId: molPhys.id,
  });

  const room220 = await getOrCreateRoom({
    number: '220',
    name: 'Noorganik kimyo va spektroskopiya laboratoriyasi',
    floor: 2,
    building: 'Tabiiy fanlar korpusi',
    departmentId: chemChair.id,
    responsibleUserId: molChem.id,
  });

  const room221 = await getOrCreateRoom({
    number: '221',
    name: 'Kimyo kafedra mudiri kabineti',
    floor: 2,
    building: 'Tabiiy fanlar korpusi',
    departmentId: chemChair.id,
    responsibleUserId: molChem.id,
  });

  // Kutubxona Binosi
  const roomARM1 = await getOrCreateRoom({
    number: 'ARM-1',
    name: 'Elektron kutubxona va kompyuter zali',
    floor: 2,
    building: 'Kutubxona binosi',
    departmentId: libraryDept.id,
    responsibleUserId: admin.id,
  });

  const roomARM2 = await getOrCreateRoom({
    number: 'ARM-2',
    name: 'Nodir nashrlar va kitob saqlash fondi',
    floor: 1,
    building: 'Kutubxona binosi',
    departmentId: libraryDept.id,
    responsibleUserId: admin.id,
  });

  // =========================================================================
  // 4. OMBORXONALAR (WAREHOUSES)
  // =========================================================================
  console.log('4. Seeding warehouses...');

  const mainWarehouse = await getOrCreateWarehouse({
    name: 'Markaziy Asosiy Omborxona',
    location: 'A-bino, 1-qavat',
    isMain: true,
  });

  const secondaryWarehouse = await getOrCreateWarehouse({
    name: '2-sonli Filial Sarf Omborxonasi',
    location: 'B-bino, yerto‘la',
    isMain: false,
  });

  // =========================================================================
  // 5. TA'MINOTCHILAR VA SHARTNOMALAR (SUPPLIERS & INVOICES)
  // =========================================================================
  console.log('5. Seeding 4 major suppliers and invoices...');

  // 1. TechPro
  const supplierTech = await getOrCreateSupplier({
    name: 'TechPro Distribution MCHJ',
    inn: '309876541',
    contractNumber: 'TR-2025-099',
    contractDate: new Date('2025-08-20'),
    contactPerson: 'Sultonov Bekzod',
    phone: '+998 90 123 45 67',
    email: 'sales@techpro.uz',
    notes: 'Davlat tenderi bo‘yicha universitet kompyuter sinflari va server uskunalari ta’minotchisi',
  });

  const invoice1 = await prisma.invoice.upsert({
    where: { invoiceNumber: 'FAK-2025-412' },
    update: { totalAmount: 185000000, supplierId: supplierTech.id },
    create: {
      invoiceNumber: 'FAK-2025-412',
      invoiceDate: new Date('2025-09-01'),
      totalAmount: 185000000,
      supplierId: supplierTech.id,
      notes: 'Davlat tenderi bo‘yicha universitet kompyuter sinflari uchun xarid',
    },
  });

  // 2. Artel
  const supplierArtel = await getOrCreateSupplier({
    name: 'Artel Electronics AJ',
    inn: '301982736',
    contractNumber: 'SH-2025-0412',
    contractDate: new Date('2025-09-05'),
    contactPerson: 'Yusupov Jamshid',
    phone: '+998 71 200 70 70',
    email: 'b2b@artelgroup.org',
    notes: 'Konditsionerlar, maishiy texnika va o‘quv xonalari iqlim tizimlari ta’minoti',
  });

  const invoice2 = await prisma.invoice.upsert({
    where: { invoiceNumber: 'FAK-2025-884' },
    update: { totalAmount: 54200000, supplierId: supplierArtel.id },
    create: {
      invoiceNumber: 'FAK-2025-884',
      invoiceDate: new Date('2025-09-10'),
      totalAmount: 54200000,
      supplierId: supplierArtel.id,
      notes: 'O‘quv laboratoriyalari va server xonalari uchun iqlim nazorati uskunalari',
    },
  });

  // 3. Grand Office Supplies
  const supplierOffice = await getOrCreateSupplier({
    name: 'Grand Office Supplies MCHJ',
    inn: '305441829',
    contractNumber: 'SH-2026-0018',
    contractDate: new Date('2026-01-10'),
    contactPerson: 'Jo‘rayev Kamol',
    phone: '+998 97 711 22 33',
    email: 'orders@grandoffice.uz',
    notes: 'Kanselyariya qog‘ozlari, toner kartridjlar va ofis jihozlari yillik yetkazib beruvchisi',
  });

  const invoice3 = await prisma.invoice.upsert({
    where: { invoiceNumber: 'FAK-2026-015' },
    update: { totalAmount: 28500000, supplierId: supplierOffice.id },
    create: {
      invoiceNumber: 'FAK-2026-015',
      invoiceDate: new Date('2026-01-15'),
      totalAmount: 28500000,
      supplierId: supplierOffice.id,
      notes: '2026-yil 1-chorak uchun qog‘oz va bosma uskunalari sarf materiallari',
    },
  });

  // 4. SoftLine Enterprise
  const supplierSoftline = await getOrCreateSupplier({
    name: 'SoftLine Enterprise O‘zbekiston',
    inn: '308112940',
    contractNumber: 'SL-2025-774',
    contractDate: new Date('2025-11-15'),
    contactPerson: 'Matkarimov Anvar',
    phone: '+998 78 140 10 10',
    email: 'corporate@softline.uz',
    notes: 'Interaktiv doskalar, tarmoq kommutatorlari va multimedia proyektorlar',
  });

  const invoice4 = await prisma.invoice.upsert({
    where: { invoiceNumber: 'FAK-2025-992' },
    update: { totalAmount: 92000000, supplierId: supplierSoftline.id },
    create: {
      invoiceNumber: 'FAK-2025-992',
      invoiceDate: new Date('2025-11-20'),
      totalAmount: 92000000,
      supplierId: supplierSoftline.id,
      notes: 'Anjumanlar zali va o‘quv laboratoriyalari uchun multimedia jihozlari',
    },
  });

  // =========================================================================
  // 6. KATEGORIYALAR VA NOMENKLATURA KATALOGI (STEP 2)
  // =========================================================================
  console.log('6. Seeding categories and items catalog...');

  const catIT = await prisma.category.upsert({
    where: { name: 'Kompyuter va IT uskunalari' },
    update: {},
    create: { name: 'Kompyuter va IT uskunalari', description: 'Noutbuklar, monitorlar, serverlar, interaktiv doskalar' },
  });

  const catPrinter = await prisma.category.upsert({
    where: { name: 'Nusxalash va bosma uskunalari' },
    update: {},
    create: { name: 'Nusxalash va bosma uskunalari', description: 'Lazerniy printerlar, MFUlar, skanerlar' },
  });

  const catAV = await prisma.category.upsert({
    where: { name: 'Audio va video konferensiya uskunalari' },
    update: {},
    create: { name: 'Audio va video konferensiya uskunalari', description: 'Multimedia proyektorlar, ekranlar va dinamiklar' },
  });

  const catOffice = await prisma.category.upsert({
    where: { name: 'Mebel va ofis jihozlari' },
    update: {},
    create: { name: 'Mebel va ofis jihozlari', description: 'Partalar, stullar, shkaflar va metall seyflar' },
  });

  const catLab = await prisma.category.upsert({
    where: { name: 'Laboratoriya va maxsus o‘quv asboblari' },
    update: {},
    create: { name: 'Laboratoriya va maxsus o‘quv asboblari', description: 'Ossilloskoplar, mikroskoplar va o‘lchov uskunalari' },
  });

  const catConsumable = await prisma.category.upsert({
    where: { name: 'Kanselyariya va sarf materiallari' },
    update: {},
    create: { name: 'Kanselyariya va sarf materiallari', description: 'Qog‘oz, toner, markerlar, registrator papkalar' },
  });

  async function getOrCreateItem(data: {
    name: string;
    model?: string;
    sku: string;
    itemType: ItemType;
    unit: string;
    minStockLimit?: number;
    description?: string;
    categoryId: string;
  }) {
    const existing = await prisma.item.findFirst({ where: { sku: data.sku } });
    if (existing) {
      return prisma.item.update({ where: { id: existing.id }, data });
    }
    return prisma.item.create({ data });
  }

  // 6.1 IT Uskunalari
  const itemLaptop = await getOrCreateItem({
    name: 'Lenovo ThinkPad E15 Noutbuki',
    model: 'ThinkPad E15 Gen 4 (Core i5, 16GB, 512GB SSD)',
    sku: 'IT-NB-001',
    itemType: ItemType.FIXED_ASSET,
    unit: 'DONA',
    categoryId: catIT.id,
  });

  const itemPC = await getOrCreateItem({
    name: 'HP ProDesk 400 G7 Microtower',
    model: 'Core i7-10700, 16GB RAM, 512GB NVMe SSD',
    sku: 'IT-PC-002',
    itemType: ItemType.FIXED_ASSET,
    unit: 'DONA',
    categoryId: catIT.id,
  });

  const itemMonitor = await getOrCreateItem({
    name: 'Dell UltraSharp 24 Monitor U2422H',
    model: '23.8" FHD IPS 100% sRGB HDMI/DP',
    sku: 'IT-MON-003',
    itemType: ItemType.FIXED_ASSET,
    unit: 'DONA',
    categoryId: catIT.id,
  });

  const itemProjector = await getOrCreateItem({
    name: 'Epson EB-E01 Multimedia Proyektor',
    model: 'EB-E01 3LCD XGA 3300 ANSI Lumens',
    sku: 'IT-PRJ-002',
    itemType: ItemType.FIXED_ASSET,
    unit: 'DONA',
    categoryId: catAV.id,
  });

  const itemServer = await getOrCreateItem({
    name: 'Dell PowerEdge R450 Rack Server',
    model: 'Xeon Silver 4314, 64GB ECC, 2x960GB SSD Enterprise',
    sku: 'IT-SRV-005',
    itemType: ItemType.FIXED_ASSET,
    unit: 'DONA',
    categoryId: catIT.id,
  });

  const itemSmartBoard = await getOrCreateItem({
    name: 'Horion 65M5A Interaktiv Sensorli Doska',
    model: '65" 4K UHD Smart Touch Display Android/Win',
    sku: 'IT-SBD-006',
    itemType: ItemType.FIXED_ASSET,
    unit: 'DONA',
    categoryId: catIT.id,
  });

  // 6.2 Printerlar
  const itemPrinterCanon = await getOrCreateItem({
    name: 'Canon i-SENSYS LBP223dw Lazerniy Printer',
    model: 'A4, 33 bet/daq, Wi-Fi, Ikki tomonlama bosma',
    sku: 'PRN-LBP-010',
    itemType: ItemType.FIXED_ASSET,
    unit: 'DONA',
    categoryId: catPrinter.id,
  });

  const itemMfuHP = await getOrCreateItem({
    name: 'HP LaserJet Pro M428fdn Ko‘p Funksiyali MFU',
    model: 'Chop etish, skaner, nusxa olish, tarmoq porti',
    sku: 'PRN-MFU-011',
    itemType: ItemType.FIXED_ASSET,
    unit: 'DONA',
    categoryId: catPrinter.id,
  });

  // 6.3 Mebel
  const itemDesk = await getOrCreateItem({
    name: 'Talabalar ikki kishilik o‘quv partasi va stullari',
    model: 'Metall profilli karkas, qayin lamellari',
    sku: 'FURN-DSK-020',
    itemType: ItemType.FIXED_ASSET,
    unit: 'KOMPLEKT',
    categoryId: catOffice.id,
  });

  const itemChair = await getOrCreateItem({
    name: 'Ergonomik ofis aylanma stuli',
    model: 'Qora setkali nafas oluvchi orqa tayanchli',
    sku: 'FURN-CHR-021',
    itemType: ItemType.FIXED_ASSET,
    unit: 'DONA',
    categoryId: catOffice.id,
  });

  const itemSafe = await getOrCreateItem({
    name: 'Valberg ikki eshikli metall hujjatlar seyfi',
    model: 'ASM-120T o‘tga chidamli qulf',
    sku: 'FURN-SEF-022',
    itemType: ItemType.FIXED_ASSET,
    unit: 'DONA',
    categoryId: catOffice.id,
  });

  // 6.4 Laboratoriya
  const itemOscilloscope = await getOrCreateItem({
    name: 'Rigol DS1054Z Raqamli 4-kanalli Ossilloskop',
    model: '50 MHz, 1 GSa/s, 24 Mpts xotira',
    sku: 'LAB-OSC-030',
    itemType: ItemType.FIXED_ASSET,
    unit: 'DONA',
    categoryId: catLab.id,
  });

  const itemMicroscope = await getOrCreateItem({
    name: 'Optika o‘quv laboratoriya mikroskopi XS-90',
    model: '1600x gacha kattalashtirish, LED yoritgich',
    sku: 'LAB-MIC-031',
    itemType: ItemType.FIXED_ASSET,
    unit: 'DONA',
    categoryId: catLab.id,
  });

  // 6.5 Kanselyariya va sarf tovarlari (Consumables)
  const itemPaper = await getOrCreateItem({
    name: 'A4 SvetoCopy Classic Qog‘ozi (500 varaq)',
    model: 'A4 80g/m2 oq',
    sku: 'CNS-A4-010',
    itemType: ItemType.CONSUMABLE,
    unit: 'PACHKA',
    minStockLimit: 25,
    categoryId: catConsumable.id,
  });

  const itemToner = await getOrCreateItem({
    name: 'HP 85A (CE285A) Qora Toner Kartridj',
    model: 'LaserJet P1102 moslashuvchan',
    sku: 'CNS-TNR-085',
    itemType: ItemType.CONSUMABLE,
    unit: 'DONA',
    minStockLimit: 10,
    categoryId: catConsumable.id,
  });

  const itemToner05A = await getOrCreateItem({
    name: 'HP 05A (CE505A) Lazer Toner Kartridj',
    model: 'LaserJet P2035 moslashuvchan',
    sku: 'CNS-TNR-05A',
    itemType: ItemType.CONSUMABLE,
    unit: 'DONA',
    minStockLimit: 8,
    categoryId: catConsumable.id,
  });

  const itemMarkers = await getOrCreateItem({
    name: 'Whiteboard doska markerlari to‘plami (4 rang)',
    model: 'Centropen oson o‘chuvchi',
    sku: 'CNS-MRK-040',
    itemType: ItemType.CONSUMABLE,
    unit: 'TOPLAM',
    minStockLimit: 15,
    categoryId: catConsumable.id,
  });

  const itemFolders = await getOrCreateItem({
    name: 'Deli A4 Registrator arxiv papkasi (75mm)',
    model: 'Qattiq polimer muqova, metall mexanizm',
    sku: 'CNS-FLDR-050',
    itemType: ItemType.CONSUMABLE,
    unit: 'DONA',
    minStockLimit: 30,
    categoryId: catConsumable.id,
  });

  // =========================================================================
  // 7. OMBOR QOLDIQLARI (STOCK LEVELS: NORMAL & LOW ON PURPOSE)
  // =========================================================================
  console.log('7. Seeding warehouse stock inventory...');

  async function upsertStock(warehouseId: string, itemId: string, quantity: number, fundingSource: any) {
    await prisma.stock.upsert({
      where: { warehouseId_itemId_fundingSource: { warehouseId, itemId, fundingSource } },
      update: { quantity, fundingSource },
      create: { warehouseId, itemId, quantity, fundingSource },
    });
  }

  // Markaziy Asosiy Omborxona qoldiqlari
  await upsertStock(mainWarehouse.id, itemPaper.id, 180, 'BYUDJET');
  await upsertStock(mainWarehouse.id, itemToner.id, 4, 'BYUDJET'); // LOW on purpose (< 10)
  await upsertStock(mainWarehouse.id, itemToner05A.id, 2, 'KONTRAKT_RIVOJLANTIRISH'); // LOW on purpose (< 8)
  await upsertStock(mainWarehouse.id, itemMarkers.id, 65, 'BYUDJET');
  await upsertStock(mainWarehouse.id, itemFolders.id, 120, 'BYUDJET');

  // 2-sonli Filial Sarf Omborxonasi qoldiqlari
  await upsertStock(secondaryWarehouse.id, itemPaper.id, 45, 'KONTRAKT_RIVOJLANTIRISH');
  await upsertStock(secondaryWarehouse.id, itemToner.id, 1, 'KONTRAKT_RIVOJLANTIRISH'); // LOW (< 10)
  await upsertStock(secondaryWarehouse.id, itemMarkers.id, 8, 'KONTRAKT_RIVOJLANTIRISH'); // LOW (< 15)
  await upsertStock(secondaryWarehouse.id, itemFolders.id, 18, 'KONTRAKT_RIVOJLANTIRISH'); // LOW (< 30)

  // =========================================================================
  // 8. OMBOR HARAKATLARI JURNALI (10 TA HAQIQIY STOCK MOVEMENTS)
  // =========================================================================
  console.log('8. Seeding 10 comprehensive stock movements...');

  async function getOrCreateMovement(data: {
    movementNumber: string;
    movementType: any;
    referenceDoc?: string;
    note?: string;
    executedById: string;
    fromRoomId?: string;
    toRoomId?: string;
    fromWarehouseId?: string;
    toWarehouseId?: string;
    supplierId?: string;
    invoiceNumber?: string;
    fundingSource?: any;
    createdAt?: Date;
    items: Array<{ itemId: string; quantity: number; note?: string }>;
  }) {
    const existing = await prisma.stockMovement.findUnique({
      where: { movementNumber: data.movementNumber },
    });
    if (existing) return existing;

    const { items, ...movData } = data;
    return prisma.stockMovement.create({
      data: {
        ...movData,
        items: {
          create: items,
        },
      },
    });
  }

  // 1. Kirim: TechPro Fakturasi
  await getOrCreateMovement({
    movementNumber: 'MOV-2025-00001',
    movementType: 'INCOMING',
    referenceDoc: 'Faktura № FAK-2025-412',
    note: 'Kompyuter sinflari uchun noutbuk va serverlar markaziy omborga qabul qilindi',
    executedById: warehouseChief.id,
    toWarehouseId: mainWarehouse.id,
    supplierId: supplierTech.id,
    invoiceNumber: 'FAK-2025-412',
    fundingSource: 'BYUDJET',
    createdAt: new Date('2025-09-02T10:30:00Z'),
    items: [
      { itemId: itemLaptop.id, quantity: 15, note: 'Lenovo ThinkPad E15' },
      { itemId: itemServer.id, quantity: 1, note: 'Dell PowerEdge R450 Server' },
    ],
  });

  // 2. Kirim: Artel Fakturasi
  await getOrCreateMovement({
    movementNumber: 'MOV-2025-00002',
    movementType: 'INCOMING',
    referenceDoc: 'Faktura № FAK-2025-884',
    note: 'Auditoriyalar iqlim tizimlari uchun konditsionerlar kirimi',
    executedById: warehouseChief.id,
    toWarehouseId: mainWarehouse.id,
    supplierId: supplierArtel.id,
    invoiceNumber: 'FAK-2025-884',
    fundingSource: 'KONTRAKT_RIVOJLANTIRISH',
    createdAt: new Date('2025-09-11T14:15:00Z'),
    items: [
      { itemId: itemPC.id, quantity: 10, note: 'HP ProDesk kompyuterlari' },
    ],
  });

  // 3. Kirim: Grand Office Sarf Materiallari
  await getOrCreateMovement({
    movementNumber: 'MOV-2025-00003',
    movementType: 'INCOMING',
    referenceDoc: 'Faktura № FAK-2026-015',
    note: '1-chorak sarf materiallari: A4 qog‘oz va original tonerlar',
    executedById: warehouseChief.id,
    toWarehouseId: mainWarehouse.id,
    supplierId: supplierOffice.id,
    invoiceNumber: 'FAK-2026-015',
    fundingSource: 'BYUDJET',
    createdAt: new Date('2026-01-16T09:00:00Z'),
    items: [
      { itemId: itemPaper.id, quantity: 200, note: 'A4 SvetoCopy qog‘ozi' },
      { itemId: itemToner.id, quantity: 15, note: 'HP 85A toner kartridjlari' },
      { itemId: itemMarkers.id, quantity: 50, note: 'Doska markerlari' },
    ],
  });

  // 4. Chiqim: 304-laboratoriyaga sarf materiali berish
  await getOrCreateMovement({
    movementNumber: 'MOV-2026-00004',
    movementType: 'OUTGOING',
    referenceDoc: 'Chiqim yukxati № OS2-2026-0001',
    note: 'Dasturiy injiniring kafedrasi oraliq nazorati uchun sarf tovarlari berildi',
    executedById: warehouseChief.id,
    fromWarehouseId: mainWarehouse.id,
    toRoomId: room304.id,
    fundingSource: 'BYUDJET',
    createdAt: new Date('2026-01-20T11:20:00Z'),
    items: [
      { itemId: itemPaper.id, quantity: 15, note: 'A4 qog‘oz' },
      { itemId: itemToner.id, quantity: 2, note: 'HP 85A toner' },
    ],
  });

  // 5. Chiqim: 401-kiberxavfsizlik laboratoriyasiga qog'oz berish
  await getOrCreateMovement({
    movementNumber: 'MOV-2026-00005',
    movementType: 'OUTGOING',
    referenceDoc: 'Chiqim yukxati № OS2-2026-0002',
    note: 'Kiberxavfsizlik kafedrasi o‘quv-uslubiy rejalari uchun materiallar',
    executedById: warehouseAssistant.id,
    fromWarehouseId: mainWarehouse.id,
    toRoomId: room401.id,
    fundingSource: 'BYUDJET',
    createdAt: new Date('2026-02-05T15:45:00Z'),
    items: [
      { itemId: itemPaper.id, quantity: 10, note: 'A4 qog‘oz' },
      { itemId: itemMarkers.id, quantity: 5, note: 'Doska markerlari' },
    ],
  });

  // 6. Omborlararo ko'chirish: Asosiy ombordan filialga
  await getOrCreateMovement({
    movementNumber: 'MOV-2026-00006',
    movementType: 'TRANSFER',
    referenceDoc: 'Ichki ko‘chirish № TRF-WH-001',
    note: 'Markaziy ombordan 2-sonli filial sarf omboriga zaxira taqsimoti',
    executedById: warehouseAssistant.id,
    fromWarehouseId: mainWarehouse.id,
    toWarehouseId: secondaryWarehouse.id,
    fundingSource: 'KONTRAKT_RIVOJLANTIRISH',
    createdAt: new Date('2026-02-12T10:00:00Z'),
    items: [
      { itemId: itemPaper.id, quantity: 50, note: 'A4 qog‘oz filial zaxirasiga' },
      { itemId: itemFolders.id, quantity: 25, note: 'Arxiv papkalari' },
    ],
  });

  // 7. Xonalararo ko'chirish: 304-xonadan 307-xonaga
  await getOrCreateMovement({
    movementNumber: 'MOV-2026-00007',
    movementType: 'TRANSFER',
    referenceDoc: 'Ichki siljish № MOV-TRF-002',
    note: 'Dasturiy injiniring kafedrasi laboratoriyalari o‘rtasida resurs taqsimoti',
    executedById: molHead.id,
    fromRoomId: room304.id,
    toRoomId: room307.id,
    fundingSource: 'BYUDJET',
    createdAt: new Date('2026-02-18T16:00:00Z'),
    items: [
      { itemId: itemDesk.id, quantity: 5, note: 'Talaba partalari' },
      { itemId: itemChair.id, quantity: 10, note: 'Aylanma stullar' },
    ],
  });

  // 8. Qaytarish (RETURN): Ortiqcha papkalar omborga qaytarildi
  await getOrCreateMovement({
    movementNumber: 'MOV-2026-00008',
    movementType: 'RETURN',
    referenceDoc: 'Qaytarish dalolatnomasi № RET-2026-0001',
    note: 'Buxgalteriya hisobi kafedrasidan bo‘shagan ortiqcha registrator papkalar qabul qilindi',
    executedById: warehouseChief.id,
    fromRoomId: room201.id,
    toWarehouseId: mainWarehouse.id,
    fundingSource: 'BYUDJET',
    createdAt: new Date('2026-02-25T11:00:00Z'),
    items: [
      { itemId: itemFolders.id, quantity: 15, note: 'Arxiv papkalari' },
    ],
  });

  // 9. Kirim: SoftLine interaktiv doskalar
  await getOrCreateMovement({
    movementNumber: 'MOV-2026-00009',
    movementType: 'INCOMING',
    referenceDoc: 'Faktura № FAK-2025-992',
    note: 'Xalqaro grant loyihasi doirasida sensorli interaktiv doskalar qabuli',
    executedById: warehouseChief.id,
    toWarehouseId: mainWarehouse.id,
    supplierId: supplierSoftline.id,
    invoiceNumber: 'FAK-2025-992',
    fundingSource: 'GRANT',
    createdAt: new Date('2025-11-22T13:30:00Z'),
    items: [
      { itemId: itemSmartBoard.id, quantity: 4, note: 'Horion 65M5A Smart Board' },
      { itemId: itemProjector.id, quantity: 6, note: 'Epson proyektorlari' },
    ],
  });

  // =========================================================================
  // 9. ASOSIY VOSITALAR, HARAKATLAR TARIXI VA TRANSFERLAR (STEP 3)
  // =========================================================================
  console.log('9. Seeding 46 comprehensive fixed assets, histories, and transfers...');

  async function getOrCreateAsset(data: {
    inventoryNumber: string;
    serialNumber?: string;
    qrCode: string;
    status: any;
    fundingSource?: any;
    purchaseDate?: Date;
    purchasePrice?: number;
    warrantyMonths?: number;
    depreciationRate?: number;
    notes?: string;
    itemId: string;
    roomId?: string | null;
    responsibleUserId?: string | null;
    supplierId?: string;
    invoiceId?: string;
  }) {
    const existing = await prisma.itemInstance.findUnique({
      where: { inventoryNumber: data.inventoryNumber },
    });
    if (existing) {
      return prisma.itemInstance.update({
        where: { id: existing.id },
        data,
      });
    }
    return prisma.itemInstance.create({ data });
  }

  async function getOrCreateTransfer(data: {
    assetId: string;
    status: any;
    note?: string;
    isReturn?: boolean;
    fromRoomId?: string | null;
    toRoomId?: string | null;
    toWarehouseId?: string | null;
    senderId: string;
    receiverId?: string | null;
    acceptedAt?: Date | null;
    createdAt?: Date;
  }) {
    const existing = await prisma.transferAcceptance.findFirst({
      where: {
        assetId: data.assetId,
        status: data.status,
        senderId: data.senderId,
      },
    });
    if (existing) return existing;
    return prisma.transferAcceptance.create({ data });
  }

  // 9.1 304-xona: Dasturiy Injiniring Laboratoriyasi №1 (MOL: Prof. Alimov Jasur)
  // 10 ta Lenovo ThinkPad E15 Noutbuki
  const assets304: any[] = [];
  for (let i = 1; i <= 10; i++) {
    const invNum = `INV-2026-${String(i).padStart(4, '0')}`;
    const snNum = `LNV-SN-88${230 + i}`;
    const asset = await getOrCreateAsset({
      inventoryNumber: invNum,
      serialNumber: snNum,
      qrCode: `UWMS:${invNum}:${snNum}`,
      status: 'IN_USE',
      fundingSource: 'BYUDJET',
      purchaseDate: new Date('2025-09-15'),
      purchasePrice: 9500000,
      warrantyMonths: 24,
      depreciationRate: 20.0,
      itemId: itemLaptop.id,
      roomId: room304.id,
      responsibleUserId: molHead.id,
      supplierId: supplierTech.id,
      invoiceId: invoice1.id,
      notes: `Dasturiy injiniring o‘quv laboratoriyasi talaba ish o‘rni №${i}`,
    });
    assets304.push(asset);

    // Initial histories
    const histCount = await prisma.assetHistory.count({ where: { assetId: asset.id } });
    if (histCount === 0) {
      await prisma.assetHistory.createMany({
        data: [
          {
            assetId: asset.id,
            action: 'KIRIM',
            fromLocation: 'TechPro Distribution MCHJ',
            toLocation: 'Markaziy Ombor',
            referenceDoc: 'Faktura № FAK-2025-412',
            executedById: warehouseChief.id,
            note: 'Tender bo‘yicha to‘liq soz holatda qabul qilindi',
            createdAt: new Date('2025-09-02T10:30:00Z'),
          },
          {
            assetId: asset.id,
            action: 'KO‘CHIRILDI',
            fromLocation: 'Markaziy Ombor',
            toLocation: '304-laboratoriya (Dasturiy injiniring)',
            fromUser: 'Toshmatov O.',
            toUser: 'Prof. Alimov Jasur',
            referenceDoc: 'Ichki siljish nakladnoyi № OS1-2025-0012',
            executedById: warehouseChief.id,
            note: 'Dasturiy injiniring kafedrasiga moddiy javobgarlikka biriktirildi',
            createdAt: new Date('2025-09-15T14:00:00Z'),
          },
        ],
      });
    }
  }

  // 1 ta Epson Proyektor (304-xona)
  const projector304 = await getOrCreateAsset({
    inventoryNumber: 'INV-2026-0011',
    serialNumber: 'EPS-PRJ-4412',
    qrCode: 'UWMS:INV-2026-0011:EPS-PRJ-4412',
    status: 'IN_USE',
    fundingSource: 'BYUDJET',
    purchaseDate: new Date('2025-10-01'),
    purchasePrice: 6200000,
    warrantyMonths: 12,
    depreciationRate: 20.0,
    itemId: itemProjector.id,
    roomId: room304.id,
    responsibleUserId: molHead.id,
    supplierId: supplierSoftline.id,
    invoiceId: invoice4.id,
    notes: 'Laboratoriya taqdimot proyektori',
  });

  // 5 ta Parta-stullar komplekti (304-xona)
  for (let i = 1; i <= 5; i++) {
    const invNum = `INV-2026-${String(11 + i).padStart(4, '0')}`;
    await getOrCreateAsset({
      inventoryNumber: invNum,
      serialNumber: `DSK-2025-0${i}`,
      qrCode: `UWMS:${invNum}:DSK-2025-0${i}`,
      status: 'IN_USE',
      fundingSource: 'BYUDJET',
      purchaseDate: new Date('2025-08-25'),
      purchasePrice: 1800000,
      warrantyMonths: 36,
      depreciationRate: 10.0,
      itemId: itemDesk.id,
      roomId: room304.id,
      responsibleUserId: molHead.id,
      supplierId: supplierArtel.id,
      invoiceId: invoice2.id,
      notes: `304-auditoriya parta-stul to‘plami №${i}`,
    });
  }

  // 9.2 305-xona: Kafedra Mudiri Kabineti (MOL: Prof. Alimov Jasur)
  const pc305 = await getOrCreateAsset({
    inventoryNumber: 'INV-2026-0017',
    serialNumber: 'HP-PD-9901',
    qrCode: 'UWMS:INV-2026-0017:HP-PD-9901',
    status: 'IN_USE',
    fundingSource: 'BYUDJET',
    purchaseDate: new Date('2025-09-12'),
    purchasePrice: 8900000,
    warrantyMonths: 24,
    depreciationRate: 20.0,
    itemId: itemPC.id,
    roomId: room305.id,
    responsibleUserId: molHead.id,
    supplierId: supplierTech.id,
    invoiceId: invoice1.id,
    notes: 'Kafedra mudiri ishchi kompyuteri',
  });

  const mon305 = await getOrCreateAsset({
    inventoryNumber: 'INV-2026-0018',
    serialNumber: 'DL-U24-1102',
    qrCode: 'UWMS:INV-2026-0018:DL-U24-1102',
    status: 'IN_USE',
    fundingSource: 'BYUDJET',
    purchaseDate: new Date('2025-09-12'),
    purchasePrice: 3100000,
    warrantyMonths: 24,
    depreciationRate: 20.0,
    itemId: itemMonitor.id,
    roomId: room305.id,
    responsibleUserId: molHead.id,
    supplierId: supplierTech.id,
    invoiceId: invoice1.id,
    notes: 'Kafedra mudiri monitori',
  });

  const prn305 = await getOrCreateAsset({
    inventoryNumber: 'INV-2026-0019',
    serialNumber: 'CN-LBP-4401',
    qrCode: 'UWMS:INV-2026-0019:CN-LBP-4401',
    status: 'IN_USE',
    fundingSource: 'BYUDJET',
    purchaseDate: new Date('2025-09-15'),
    purchasePrice: 3800000,
    warrantyMonths: 12,
    depreciationRate: 20.0,
    itemId: itemPrinterCanon.id,
    roomId: room305.id,
    responsibleUserId: molHead.id,
    supplierId: supplierTech.id,
    invoiceId: invoice1.id,
    notes: 'Kafedra mudiri shaxsiy lazer printeri',
  });

  const chair305 = await getOrCreateAsset({
    inventoryNumber: 'INV-2026-0020',
    serialNumber: 'CHR-OF-001',
    qrCode: 'UWMS:INV-2026-0020:CHR-OF-001',
    status: 'IN_USE',
    fundingSource: 'BYUDJET',
    purchaseDate: new Date('2025-08-25'),
    purchasePrice: 1200000,
    warrantyMonths: 12,
    depreciationRate: 10.0,
    itemId: itemChair.id,
    roomId: room305.id,
    responsibleUserId: molHead.id,
    supplierId: supplierArtel.id,
    invoiceId: invoice2.id,
    notes: 'Ofis aylanma stuli',
  });

  const safe305 = await getOrCreateAsset({
    inventoryNumber: 'INV-2026-0021',
    serialNumber: 'VLB-SF-880',
    qrCode: 'UWMS:INV-2026-0021:VLB-SF-880',
    status: 'IN_USE',
    fundingSource: 'BYUDJET',
    purchaseDate: new Date('2025-08-25'),
    purchasePrice: 4500000,
    warrantyMonths: 36,
    depreciationRate: 10.0,
    itemId: itemSafe.id,
    roomId: room305.id,
    responsibleUserId: molHead.id,
    supplierId: supplierArtel.id,
    invoiceId: invoice2.id,
    notes: 'Kafedra xizmat hujjatlari seyfi',
  });

  // 9.3 401-xona: Kiberxavfsizlik Laboratoriyasi (MOL: Dots. Qosimov Shuhrat)
  for (let i = 1; i <= 5; i++) {
    const invPC = `INV-2026-${String(21 + i).padStart(4, '0')}`;
    const invMon = `INV-2026-${String(26 + i).padStart(4, '0')}`;

    await getOrCreateAsset({
      inventoryNumber: invPC,
      serialNumber: `HP-CYB-0${i}`,
      qrCode: `UWMS:${invPC}:HP-CYB-0${i}`,
      status: 'IN_USE',
      fundingSource: 'BYUDJET',
      purchaseDate: new Date('2025-09-12'),
      purchasePrice: 8900000,
      warrantyMonths: 24,
      depreciationRate: 20.0,
      itemId: itemPC.id,
      roomId: room401.id,
      responsibleUserId: molCyber.id,
      supplierId: supplierTech.id,
      invoiceId: invoice1.id,
      notes: `Kiberxavfsizlik o‘quv stantsiyasi №${i}`,
    });

    await getOrCreateAsset({
      inventoryNumber: invMon,
      serialNumber: `DL-CYB-0${i}`,
      qrCode: `UWMS:${invMon}:DL-CYB-0${i}`,
      status: 'IN_USE',
      fundingSource: 'BYUDJET',
      purchaseDate: new Date('2025-09-12'),
      purchasePrice: 3100000,
      warrantyMonths: 24,
      depreciationRate: 20.0,
      itemId: itemMonitor.id,
      roomId: room401.id,
      responsibleUserId: molCyber.id,
      supplierId: supplierTech.id,
      invoiceId: invoice1.id,
      notes: `Dell UltraSharp monitor №${i}`,
    });
  }

  // 9.4 405-xona: Sun'iy Intellekt Markazi (MOL: Dr. Rahimov Aziz)
  const server405 = await getOrCreateAsset({
    inventoryNumber: 'INV-2026-0032',
    serialNumber: 'DL-R450-SRV-01',
    qrCode: 'UWMS:INV-2026-0032:DL-R450-SRV-01',
    status: 'IN_USE',
    fundingSource: 'GRANT',
    purchaseDate: new Date('2025-10-15'),
    purchasePrice: 95000000,
    warrantyMonths: 36,
    depreciationRate: 20.0,
    itemId: itemServer.id,
    roomId: room405.id,
    responsibleUserId: molAI.id,
    supplierId: supplierTech.id,
    invoiceId: invoice1.id,
    notes: 'Sun’iy intellekt va neyrotarmoqlar hisoblash serveri (Xalqaro grant)',
  });

  const smartBoard405 = await getOrCreateAsset({
    inventoryNumber: 'INV-2026-0033',
    serialNumber: 'HR-65M5A-01',
    qrCode: 'UWMS:INV-2026-0033:HR-65M5A-01',
    status: 'IN_USE',
    fundingSource: 'GRANT',
    purchaseDate: new Date('2025-11-20'),
    purchasePrice: 18500000,
    warrantyMonths: 24,
    depreciationRate: 20.0,
    itemId: itemSmartBoard.id,
    roomId: room405.id,
    responsibleUserId: molAI.id,
    supplierId: supplierSoftline.id,
    invoiceId: invoice4.id,
    notes: 'Horion 65" interaktiv sensorli taqdimot doskasi',
  });

  // 9.5 201-xona: Buxgalteriya Kafedrasi (MOL: Prof. Yoqubov Sardor)
  const mfu201 = await getOrCreateAsset({
    inventoryNumber: 'INV-2026-0034',
    serialNumber: 'HP-M428-MFU-01',
    qrCode: 'UWMS:INV-2026-0034:HP-M428-MFU-01',
    status: 'IN_USE',
    fundingSource: 'KONTRAKT_RIVOJLANTIRISH',
    purchaseDate: new Date('2025-09-20'),
    purchasePrice: 6800000,
    warrantyMonths: 12,
    depreciationRate: 20.0,
    itemId: itemMfuHP.id,
    roomId: room201.id,
    responsibleUserId: molAcc.id,
    supplierId: supplierTech.id,
    invoiceId: invoice1.id,
    notes: 'Kafedra hisobotlari va hujjatlarini nusxalash MFU',
  });

  const laptop201 = await getOrCreateAsset({
    inventoryNumber: 'INV-2026-0035',
    serialNumber: 'LNV-SN-88250',
    qrCode: 'UWMS:INV-2026-0035:LNV-SN-88250',
    status: 'IN_USE',
    fundingSource: 'KONTRAKT_RIVOJLANTIRISH',
    purchaseDate: new Date('2025-09-15'),
    purchasePrice: 9500000,
    warrantyMonths: 24,
    depreciationRate: 20.0,
    itemId: itemLaptop.id,
    roomId: room201.id,
    responsibleUserId: molAcc.id,
    supplierId: supplierTech.id,
    invoiceId: invoice1.id,
    notes: 'Buxgalteriya kafedrasi mudiri xizmat noutbuki',
  });

  // 9.6 215-xona: Fizika Laboratoriyasi (MOL: Prof. Mahmudov Timur)
  await getOrCreateAsset({
    inventoryNumber: 'INV-2026-0036',
    serialNumber: 'RG-DS1054-01',
    qrCode: 'UWMS:INV-2026-0036:RG-DS1054-01',
    status: 'IN_USE',
    fundingSource: 'BYUDJET',
    purchaseDate: new Date('2025-10-05'),
    purchasePrice: 6500000,
    warrantyMonths: 24,
    depreciationRate: 15.0,
    itemId: itemOscilloscope.id,
    roomId: room215.id,
    responsibleUserId: molPhys.id,
    supplierId: supplierArtel.id,
    invoiceId: invoice2.id,
    notes: 'Raqamli ossilloskop tajriba o‘tkazish stendi №1',
  });

  await getOrCreateAsset({
    inventoryNumber: 'INV-2026-0037',
    serialNumber: 'RG-DS1054-02',
    qrCode: 'UWMS:INV-2026-0037:RG-DS1054-02',
    status: 'IN_USE',
    fundingSource: 'BYUDJET',
    purchaseDate: new Date('2025-10-05'),
    purchasePrice: 6500000,
    warrantyMonths: 24,
    depreciationRate: 15.0,
    itemId: itemOscilloscope.id,
    roomId: room215.id,
    responsibleUserId: molPhys.id,
    supplierId: supplierArtel.id,
    invoiceId: invoice2.id,
    notes: 'Raqamli ossilloskop tajriba o‘tkazish stendi №2',
  });

  await getOrCreateAsset({
    inventoryNumber: 'INV-2026-0038',
    serialNumber: 'MC-XS90-01',
    qrCode: 'UWMS:INV-2026-0038:MC-XS90-01',
    status: 'IN_USE',
    fundingSource: 'BYUDJET',
    purchaseDate: new Date('2025-10-05'),
    purchasePrice: 3200000,
    warrantyMonths: 24,
    depreciationRate: 15.0,
    itemId: itemMicroscope.id,
    roomId: room215.id,
    responsibleUserId: molPhys.id,
    supplierId: supplierArtel.id,
    invoiceId: invoice2.id,
    notes: 'Optika laboratoriyasi mikroskopi №1',
  });

  await getOrCreateAsset({
    inventoryNumber: 'INV-2026-0039',
    serialNumber: 'MC-XS90-02',
    qrCode: 'UWMS:INV-2026-0039:MC-XS90-02',
    status: 'IN_USE',
    fundingSource: 'BYUDJET',
    purchaseDate: new Date('2025-10-05'),
    purchasePrice: 3200000,
    warrantyMonths: 24,
    depreciationRate: 15.0,
    itemId: itemMicroscope.id,
    roomId: room215.id,
    responsibleUserId: molPhys.id,
    supplierId: supplierArtel.id,
    invoiceId: invoice2.id,
    notes: 'Optika laboratoriyasi mikroskopi №2',
  });

  // 9.7 301-xona: ATM Server Xonasi (MOL: admin)
  await getOrCreateAsset({
    inventoryNumber: 'INV-2026-0040',
    serialNumber: 'DL-R450-SRV-02',
    qrCode: 'UWMS:INV-2026-0040:DL-R450-SRV-02',
    status: 'IN_USE',
    fundingSource: 'BYUDJET',
    purchaseDate: new Date('2025-09-02'),
    purchasePrice: 95000000,
    warrantyMonths: 36,
    depreciationRate: 20.0,
    itemId: itemServer.id,
    roomId: room301.id,
    responsibleUserId: admin.id,
    supplierId: supplierTech.id,
    invoiceId: invoice1.id,
    notes: 'Universitet asosiy veb va ma’lumotlar bazasi klaster serveri',
  });

  // 9.8 Yangi kelgan ombordagi aktivlar (status: NEW, room: null, MOL: omborchi)
  const assetNew1 = await getOrCreateAsset({
    inventoryNumber: 'INV-2026-0041',
    serialNumber: 'LNV-SN-88291',
    qrCode: 'UWMS:INV-2026-0041:LNV-SN-88291',
    status: 'NEW',
    fundingSource: 'BYUDJET',
    purchaseDate: new Date('2026-02-15'),
    purchasePrice: 9500000,
    warrantyMonths: 24,
    depreciationRate: 20.0,
    itemId: itemLaptop.id,
    roomId: null,
    responsibleUserId: warehouseChief.id,
    supplierId: supplierTech.id,
    invoiceId: invoice1.id,
    notes: 'Markaziy omborda yangi qabul qilingan, xonaga topshirilishi kutilmoqda',
  });

  const assetNew2 = await getOrCreateAsset({
    inventoryNumber: 'INV-2026-0042',
    serialNumber: 'LNV-SN-88292',
    qrCode: 'UWMS:INV-2026-0042:LNV-SN-88292',
    status: 'NEW',
    fundingSource: 'KONTRAKT_RIVOJLANTIRISH',
    purchaseDate: new Date('2026-02-15'),
    purchasePrice: 9500000,
    warrantyMonths: 24,
    depreciationRate: 20.0,
    itemId: itemLaptop.id,
    roomId: null,
    responsibleUserId: warehouseChief.id,
    supplierId: supplierTech.id,
    invoiceId: invoice1.id,
    notes: 'Markaziy omborda, kafedraga topshirish rejalashtirilgan',
  });

  const assetNew3 = await getOrCreateAsset({
    inventoryNumber: 'INV-2026-0043',
    serialNumber: 'CN-LBP-4490',
    qrCode: 'UWMS:INV-2026-0043:CN-LBP-4490',
    status: 'NEW',
    fundingSource: 'BYUDJET',
    purchaseDate: new Date('2026-02-15'),
    purchasePrice: 3800000,
    warrantyMonths: 12,
    depreciationRate: 20.0,
    itemId: itemPrinterCanon.id,
    roomId: null,
    responsibleUserId: warehouseChief.id,
    supplierId: supplierTech.id,
    invoiceId: invoice1.id,
    notes: 'Yangi zaxira printeri',
  });

  // 9.9 Ta'mirdagi uskunalar (status: IN_REPAIR)
  await getOrCreateAsset({
    inventoryNumber: 'INV-2026-0044',
    serialNumber: 'DL-U24-9981',
    qrCode: 'UWMS:INV-2026-0044:DL-U24-9981',
    status: 'IN_REPAIR',
    fundingSource: 'BYUDJET',
    purchaseDate: new Date('2025-09-12'),
    purchasePrice: 3100000,
    warrantyMonths: 24,
    depreciationRate: 20.0,
    itemId: itemMonitor.id,
    roomId: room401.id,
    responsibleUserId: molCyber.id,
    supplierId: supplierTech.id,
    invoiceId: invoice1.id,
    notes: 'Ta’mirda: Matritsa shleyfi nosozligi aniqlangan',
  });

  await getOrCreateAsset({
    inventoryNumber: 'INV-2026-0045',
    serialNumber: 'EPS-PRJ-7719',
    qrCode: 'UWMS:INV-2026-0045:EPS-PRJ-7719',
    status: 'IN_REPAIR',
    fundingSource: 'BYUDJET',
    purchaseDate: new Date('2025-10-01'),
    purchasePrice: 6200000,
    warrantyMonths: 12,
    depreciationRate: 20.0,
    itemId: itemProjector.id,
    roomId: room304.id,
    responsibleUserId: molHead.id,
    supplierId: supplierSoftline.id,
    invoiceId: invoice4.id,
    notes: 'Ta’mirda: Proyektor lampasi resursi tugagan',
  });

  // 9.10 Hisobdan chiqarilgan (status: WRITTEN_OFF)
  await getOrCreateAsset({
    inventoryNumber: 'INV-2026-0046',
    serialNumber: 'HP-PD-2018-OLD',
    qrCode: 'UWMS:INV-2026-0046:HP-PD-2018-OLD',
    status: 'WRITTEN_OFF',
    fundingSource: 'BYUDJET',
    purchaseDate: new Date('2020-03-10'),
    purchasePrice: 5400000,
    warrantyMonths: 12,
    depreciationRate: 20.0,
    itemId: itemPC.id,
    roomId: room307.id,
    responsibleUserId: molHead.id,
    supplierId: supplierTech.id,
    invoiceId: invoice1.id,
    notes: 'Hisobdan chiqarilgan: 100% amortizatsiya, tiklab bo‘lmas plata kuyishi (OS-4 akt)',
  });

  // =========================================================================
  // 10. IKKI TOMONLAMA TOPSHIRISH-QABUL QILISH (TRANSFER ACCEPTANCES)
  // =========================================================================
  console.log('10. Seeding transfer acceptance workflow records...');

  // 1. PENDING: Omborchi 305-xona mudiri Prof. Alimovga topshirmoqda
  await getOrCreateTransfer({
    assetId: assetNew1.id,
    status: 'PENDING',
    note: 'Dasturiy injiniring kafedra mudiriga xizmat noutbuki topshirilishi',
    isReturn: false,
    fromRoomId: null,
    toRoomId: room305.id,
    toWarehouseId: null,
    senderId: warehouseChief.id,
    receiverId: molHead.id,
    acceptedAt: null,
    createdAt: new Date('2026-03-10T11:00:00Z'),
  });

  // 2. PENDING: Omborchi Kiberxavfsizlik kafedrasiga yangi noutbuk topshirmoqda
  await getOrCreateTransfer({
    assetId: assetNew2.id,
    status: 'PENDING',
    note: 'Kiberxavfsizlik kafedrasi mudiri xizmat xonasiga noutbuk topshirish',
    isReturn: false,
    fromRoomId: null,
    toRoomId: room402.id,
    toWarehouseId: null,
    senderId: warehouseChief.id,
    receiverId: molCyber.id,
    acceptedAt: null,
    createdAt: new Date('2026-03-11T09:30:00Z'),
  });

  // 3. PENDING: Omborchi Sun'iy intellekt kafedrasiga yangi printer topshirmoqda
  await getOrCreateTransfer({
    assetId: assetNew3.id,
    status: 'PENDING',
    note: 'Sun’iy intellekt kafedrasi 406-kabinetiga lazer printer topshirish',
    isReturn: false,
    fromRoomId: null,
    toRoomId: room406.id,
    toWarehouseId: null,
    senderId: warehouseChief.id,
    receiverId: molAI.id,
    acceptedAt: null,
    createdAt: new Date('2026-03-12T14:15:00Z'),
  });

  // 4. ACCEPTED: 304-laboratoriyaga noutbuk muvaffaqiyatli qabul qilingan
  await getOrCreateTransfer({
    assetId: assets304[0].id,
    status: 'ACCEPTED',
    note: 'O‘quv laboratoriyasi uchun kompyuter sinfiga topshirildi va to‘liq soz qabul qilindi',
    isReturn: false,
    fromRoomId: null,
    toRoomId: room304.id,
    toWarehouseId: null,
    senderId: warehouseChief.id,
    receiverId: molHead.id,
    acceptedAt: new Date('2025-09-15T15:00:00Z'),
    createdAt: new Date('2025-09-15T10:00:00Z'),
  });

  // 5. ACCEPTED: 304-xonaga Epson proyektor qabul qilingan
  await getOrCreateTransfer({
    assetId: projector304.id,
    status: 'ACCEPTED',
    note: 'Multimedia proyektori laboratoriyaga qabul qilindi (OS-1)',
    isReturn: false,
    fromRoomId: null,
    toRoomId: room304.id,
    toWarehouseId: null,
    senderId: warehouseChief.id,
    receiverId: molHead.id,
    acceptedAt: new Date('2025-10-02T16:00:00Z'),
    createdAt: new Date('2025-10-01T11:00:00Z'),
  });

  // 6. ACCEPTED: 405-xonaga Dell server qabul qilingan
  await getOrCreateTransfer({
    assetId: server405.id,
    status: 'ACCEPTED',
    note: 'Grant hisobidan xarid qilingan AI server markazga qabul qilindi',
    isReturn: false,
    fromRoomId: null,
    toRoomId: room405.id,
    toWarehouseId: null,
    senderId: warehouseChief.id,
    receiverId: molAI.id,
    acceptedAt: new Date('2025-10-16T12:00:00Z'),
    createdAt: new Date('2025-10-15T14:00:00Z'),
  });

  // 7. ACCEPTED: 201-buxgalteriyaga HP MFU qabul qilingan
  await getOrCreateTransfer({
    assetId: mfu201.id,
    status: 'ACCEPTED',
    note: 'Buxgalteriya kafedrasiga ko‘p funksiyali MFU qabul qilindi',
    isReturn: false,
    fromRoomId: null,
    toRoomId: room201.id,
    toWarehouseId: null,
    senderId: warehouseChief.id,
    receiverId: molAcc.id,
    acceptedAt: new Date('2025-09-21T10:00:00Z'),
    createdAt: new Date('2025-09-20T11:30:00Z'),
  });

  // 8. REJECTED: 304-xonadan 306-xonaga ko'chirish rad etilgan
  await getOrCreateTransfer({
    assetId: assets304[1].id,
    status: 'REJECTED',
    note: 'Rad etildi: 306-o‘qituvchilar xonasida noutbuk uchun himoyalangan ish o‘rni mavjud emas',
    isReturn: false,
    fromRoomId: room304.id,
    toRoomId: room306.id,
    toWarehouseId: null,
    senderId: molHead.id,
    receiverId: molHead.id,
    acceptedAt: null,
    createdAt: new Date('2026-01-14T09:00:00Z'),
  });

  console.log('Step 3 successfully completed!');

  // =========================================================================
  // 11. KAFEDRALAR OYLIK SARF KVOTALARI (30 TA KVOTA YOZUVI)
  // =========================================================================
  console.log('11. Seeding 30 comprehensive department consumable quotas...');

  // 11.1 Sentyabr 2026 (Joriy davr - 2026-09)
  // SE Chair
  await getOrCreateDepartmentQuota({
    departmentId: seChair.id,
    itemId: itemPaper.id,
    period: '2026-09',
    monthlyLimit: 15,
    usedQuantity: 8,
    notes: 'Dasturiy injiniring kafedrasi oylik standart me’yori',
  });
  await getOrCreateDepartmentQuota({
    departmentId: seChair.id,
    itemId: itemToner.id,
    period: '2026-09',
    monthlyLimit: 3,
    usedQuantity: 2,
    notes: 'Kafedra Canon printerlari uchun kartridj',
  });
  await getOrCreateDepartmentQuota({
    departmentId: seChair.id,
    itemId: itemMarkers.id,
    period: '2026-09',
    monthlyLimit: 5,
    usedQuantity: 4,
    notes: 'Whiteboard doskalari uchun markerlar (Chegara yaqin)',
  });

  // AI Chair
  await getOrCreateDepartmentQuota({
    departmentId: aiChair.id,
    itemId: itemPaper.id,
    period: '2026-09',
    monthlyLimit: 12,
    usedQuantity: 10,
    notes: 'Sun’iy intellekt kafedrasi ilmiy hisobotlari (Chegara yaqin)',
  });
  await getOrCreateDepartmentQuota({
    departmentId: aiChair.id,
    itemId: itemToner.id,
    period: '2026-09',
    monthlyLimit: 2,
    usedQuantity: 1,
    notes: 'HP printeri uchun toner',
  });
  await getOrCreateDepartmentQuota({
    departmentId: aiChair.id,
    itemId: itemMarkers.id,
    period: '2026-09',
    monthlyLimit: 4,
    usedQuantity: 2,
    notes: 'Laboratoriya xonalari uchun',
  });

  // Cyber Chair - EXCEEDED
  await getOrCreateDepartmentQuota({
    departmentId: cyberChair.id,
    itemId: itemPaper.id,
    period: '2026-09',
    monthlyLimit: 10,
    usedQuantity: 12,
    notes: 'Limitdan oshgan: Kiberxavfsizlik o‘quv qo‘llanmalari va oraliq nazorat varaqalari uchun qo‘shimcha sarflandi',
  });
  await getOrCreateDepartmentQuota({
    departmentId: cyberChair.id,
    itemId: itemToner.id,
    period: '2026-09',
    monthlyLimit: 2,
    usedQuantity: 2,
    notes: 'Limitga yetgan (100%)',
  });

  // Accounting Chair - EXCEEDED
  await getOrCreateDepartmentQuota({
    departmentId: accChair.id,
    itemId: itemPaper.id,
    period: '2026-09',
    monthlyLimit: 20,
    usedQuantity: 24,
    notes: 'Limitdan oshgan: Yillik amaliyot hisobotlari va 1C audit jurnallari chop etilgan',
  });
  await getOrCreateDepartmentQuota({
    departmentId: accChair.id,
    itemId: itemFolders.id,
    period: '2026-09',
    monthlyLimit: 15,
    usedQuantity: 15,
    notes: 'Arxiv papkalari limiti to‘liq sarflangan',
  });
  await getOrCreateDepartmentQuota({
    departmentId: accChair.id,
    itemId: itemToner05A.id,
    period: '2026-09',
    monthlyLimit: 3,
    usedQuantity: 2,
    notes: 'HP 2035 printerlari uchun',
  });

  // Finance Chair
  await getOrCreateDepartmentQuota({
    departmentId: finChair.id,
    itemId: itemPaper.id,
    period: '2026-09',
    monthlyLimit: 15,
    usedQuantity: 13,
    notes: 'Bank ishi va ekonometrika seminarlari (Chegara yaqin)',
  });
  await getOrCreateDepartmentQuota({
    departmentId: finChair.id,
    itemId: itemFolders.id,
    period: '2026-09',
    monthlyLimit: 10,
    usedQuantity: 6,
    notes: 'Kurs ishlari va hisobot papkalari',
  });

  // Mathematics Chair
  await getOrCreateDepartmentQuota({
    departmentId: mathChair.id,
    itemId: itemPaper.id,
    period: '2026-09',
    monthlyLimit: 12,
    usedQuantity: 5,
    notes: 'Matematika kafedrasi odatiy sarfi',
  });
  await getOrCreateDepartmentQuota({
    departmentId: mathChair.id,
    itemId: itemMarkers.id,
    period: '2026-09',
    monthlyLimit: 8,
    usedQuantity: 7,
    notes: 'Auditoriyalar uchun markerlar to‘plami (Chegara yaqin)',
  });

  // Physics Chair
  await getOrCreateDepartmentQuota({
    departmentId: physChair.id,
    itemId: itemPaper.id,
    period: '2026-09',
    monthlyLimit: 10,
    usedQuantity: 4,
    notes: 'Fizika laboratoriya jurnallari uchun',
  });

  // IT Center (ATM)
  await getOrCreateDepartmentQuota({
    departmentId: itCenter.id,
    itemId: itemPaper.id,
    period: '2026-09',
    monthlyLimit: 8,
    usedQuantity: 3,
    notes: 'Tarmoq protokollari va server jurnallari',
  });
  await getOrCreateDepartmentQuota({
    departmentId: itCenter.id,
    itemId: itemToner.id,
    period: '2026-09',
    monthlyLimit: 4,
    usedQuantity: 3,
    notes: 'ATM boshqarma printeri',
  });

  // Accounting Department (Bosh buxgalteriya)
  await getOrCreateDepartmentQuota({
    departmentId: accountingDept.id,
    itemId: itemPaper.id,
    period: '2026-09',
    monthlyLimit: 30,
    usedQuantity: 25,
    notes: '3-chorak moliyaviy hisobotlari uchun (Chegara yaqin)',
  });
  await getOrCreateDepartmentQuota({
    departmentId: accountingDept.id,
    itemId: itemFolders.id,
    period: '2026-09',
    monthlyLimit: 25,
    usedQuantity: 20,
    notes: 'Moliyaviy yillik hujjatlar arxivi',
  });
  await getOrCreateDepartmentQuota({
    departmentId: accountingDept.id,
    itemId: itemToner05A.id,
    period: '2026-09',
    monthlyLimit: 5,
    usedQuantity: 4,
    notes: 'MFU hisobot printerlari uchun',
  });

  // HR Department (Kadrlar)
  await getOrCreateDepartmentQuota({
    departmentId: hrDept.id,
    itemId: itemPaper.id,
    period: '2026-09',
    monthlyLimit: 15,
    usedQuantity: 9,
    notes: 'Xodimlar shaxsiy yig‘majildlari va buyruqlar',
  });
  await getOrCreateDepartmentQuota({
    departmentId: hrDept.id,
    itemId: itemFolders.id,
    period: '2026-09',
    monthlyLimit: 15,
    usedQuantity: 11,
    notes: 'Yangi xodimlar papkalari',
  });

  // Facilities Department (Xo‘jalik)
  await getOrCreateDepartmentQuota({
    departmentId: facilitiesDept.id,
    itemId: itemPaper.id,
    period: '2026-09',
    monthlyLimit: 5,
    usedQuantity: 2,
    notes: 'Xo‘jalik xizmati dalolatnomalari uchun',
  });

  // 11.2 Avgust 2026 (Oldingi davr - 2026-08)
  await getOrCreateDepartmentQuota({
    departmentId: seChair.id,
    itemId: itemPaper.id,
    period: '2026-08',
    monthlyLimit: 15,
    usedQuantity: 14,
    notes: 'O‘tgan oylik sarf (avgust yakuniy)',
  });
  await getOrCreateDepartmentQuota({
    departmentId: seChair.id,
    itemId: itemToner.id,
    period: '2026-08',
    monthlyLimit: 3,
    usedQuantity: 3,
    notes: 'To‘liq foydalanilgan',
  });
  await getOrCreateDepartmentQuota({
    departmentId: aiChair.id,
    itemId: itemPaper.id,
    period: '2026-08',
    monthlyLimit: 12,
    usedQuantity: 8,
    notes: 'Avgust oylik sarf',
  });
  await getOrCreateDepartmentQuota({
    departmentId: accountingDept.id,
    itemId: itemPaper.id,
    period: '2026-08',
    monthlyLimit: 30,
    usedQuantity: 29,
    notes: 'Yarim yillik moliyaviy hisobotlar',
  });
  await getOrCreateDepartmentQuota({
    departmentId: accountingDept.id,
    itemId: itemFolders.id,
    period: '2026-08',
    monthlyLimit: 25,
    usedQuantity: 25,
    notes: '100% sarflangan',
  });
  await getOrCreateDepartmentQuota({
    departmentId: cyberChair.id,
    itemId: itemPaper.id,
    period: '2026-08',
    monthlyLimit: 10,
    usedQuantity: 9,
    notes: 'Avgust oylik sarf',
  });

  // =========================================================================
  // 12. TALABNOMALAR VA MAHSULOTLAR (12 TA REQUEST VA WORKFLOW)
  // =========================================================================
  console.log('12. Seeding 12 comprehensive requests with items, approval flows, and quota status...');

  // 1. PENDING: Dasturiy injiniring o'qituvchisi amaliy darslar uchun so'ragan
  await getOrCreateRequest({
    requestNumber: 'REQ-2026-101',
    purpose: 'Dasturiy injiniring o‘quv laboratoriyasi (304-xona) amaliy mashg‘ulotlari uchun sarf materiallari',
    status: RequestStatus.PENDING,
    isOverQuota: false,
    specialApprovalNeeded: false,
    notes: 'O‘quv semestri boshlanishi sababli laboratoriya ishlari topshiriqlarini chop etish zarur',
    approvalNote: null,
    requesterId: employee.id,
    departmentId: seChair.id,
    approvedById: null,
    createdAt: new Date('2026-09-12T09:30:00Z'),
    items: [
      { itemId: itemPaper.id, requestedQty: 4, approvedQty: null },
      { itemId: itemMarkers.id, requestedQty: 2, approvedQty: null },
    ],
  });

  // 2. PENDING (Maxsus ruxsat talab qiluvchi / Over quota)
  await getOrCreateRequest({
    requestNumber: 'REQ-2026-102',
    purpose: 'Sun’iy intellekt kafedrasi xalqaro ilmiy-amaliy konferensiyasi materiallarini chop etish',
    status: RequestStatus.PENDING,
    isOverQuota: true,
    specialApprovalNeeded: true,
    notes: 'Kafedra oylik limitidan ortiqcha: "AI & Big Data 2026" xalqaro konferensiyasi to‘plamlari uchun rektorat ruxsati so‘raladi',
    approvalNote: null,
    requesterId: molAI.id,
    departmentId: aiChair.id,
    approvedById: null,
    createdAt: new Date('2026-09-13T14:15:00Z'),
    items: [
      { itemId: itemPaper.id, requestedQty: 18, approvedQty: null },
      { itemId: itemToner.id, requestedQty: 2, approvedQty: null },
      { itemId: itemFolders.id, requestedQty: 12, approvedQty: null },
    ],
  });

  // 3. APPROVED_BY_HEAD: Kiberxavfsizlik kafedrasi talabnomasi kafedra mudiri tomonidan tasdiqlangan
  await getOrCreateRequest({
    requestNumber: 'REQ-2026-103',
    purpose: 'Kiberxavfsizlik kafedrasida yangi o‘quv yili kiberhimoya amaliyot darslari ta’minoti',
    status: RequestStatus.APPROVED_BY_HEAD,
    isOverQuota: false,
    specialApprovalNeeded: false,
    notes: '308-auditoriyadagi amaliyot xonalari uchun',
    approvalNote: 'Kafedra mudiri tomonidan tasdiqlandi. Laboratoriya jadvaliga muvofiq omborxonadan berilsin.',
    requesterId: teacher2.id,
    departmentId: cyberChair.id,
    approvedById: molCyber.id,
    createdAt: new Date('2026-09-10T11:00:00Z'),
    items: [
      { itemId: itemPaper.id, requestedQty: 6, approvedQty: 6 },
      { itemId: itemToner.id, requestedQty: 1, approvedQty: 1 },
    ],
  });

  // 4. APPROVED_BY_HEAD: Oliy matematika kafedrasi
  await getOrCreateRequest({
    requestNumber: 'REQ-2026-104',
    purpose: 'Oliy matematika kafedrasi talabalari uchun oraliq nazorat savolnomalari va blankalari',
    status: RequestStatus.APPROVED_BY_HEAD,
    isOverQuota: false,
    specialApprovalNeeded: false,
    notes: '112-auditoriya darslari uchun',
    approvalNote: 'Kafedra oylik kvotasi doirasida tasdiqlandi.',
    requesterId: molMath.id,
    departmentId: mathChair.id,
    approvedById: molMath.id,
    createdAt: new Date('2026-09-11T16:40:00Z'),
    items: [
      { itemId: itemPaper.id, requestedQty: 5, approvedQty: 5 },
      { itemId: itemMarkers.id, requestedQty: 3, approvedQty: 3 },
    ],
  });

  // 5. APPROVED_BY_WAREHOUSE: Ombor mudiri tomonidan ajratilgan
  await getOrCreateRequest({
    requestNumber: 'REQ-2026-105',
    purpose: 'Buxgalteriya hisobi kafedrasi 1C laboratoriyasi (202-xona) va hisobotlar arxivi',
    status: RequestStatus.APPROVED_BY_WAREHOUSE,
    isOverQuota: false,
    specialApprovalNeeded: false,
    notes: 'Hisobotlar uchun registrator papkalar va qog‘oz',
    approvalNote: 'Ombor mudiri tomonidan tasdiqlandi. Markaziy ombordan ajratildi, qabul qilib olinishi mumkin.',
    requesterId: docentValiyev.id,
    departmentId: accChair.id,
    approvedById: warehouseChief.id,
    createdAt: new Date('2026-09-08T10:20:00Z'),
    items: [
      { itemId: itemPaper.id, requestedQty: 10, approvedQty: 10 },
      { itemId: itemToner05A.id, requestedQty: 1, approvedQty: 1 },
      { itemId: itemFolders.id, requestedQty: 8, approvedQty: 8 },
    ],
  });

  // 6. APPROVED_BY_WAREHOUSE: ATM bo'limi
  await getOrCreateRequest({
    requestNumber: 'REQ-2026-106',
    purpose: 'Axborot texnologiyalari markazi (ATM) server xonasi me’yoriy hujjatlari va xizmat jurnallari',
    status: RequestStatus.APPROVED_BY_WAREHOUSE,
    isOverQuota: false,
    specialApprovalNeeded: false,
    notes: 'Server xonasi kundalik operatsion jurnallari chop etish uchun',
    approvalNote: 'Ombor mudiri tomonidan ajratildi. 1-bino omborxonasidan tarqatishga tayyor.',
    requesterId: admin.id,
    departmentId: itCenter.id,
    approvedById: warehouseChief.id,
    createdAt: new Date('2026-09-09T15:00:00Z'),
    items: [
      { itemId: itemPaper.id, requestedQty: 3, approvedQty: 3 },
      { itemId: itemToner.id, requestedQty: 1, approvedQty: 1 },
    ],
  });

  // 7. FULFILLED: Bosh buxgalteriya 3-chorak moliyaviy hisobotlari
  await getOrCreateRequest({
    requestNumber: 'REQ-2026-107',
    purpose: 'Universitet bosh buxgalteriyasi 3-chorak moliyaviy hisobotlari va audit hujjatlari',
    status: RequestStatus.FULFILLED,
    isOverQuota: false,
    specialApprovalNeeded: false,
    notes: 'Yillik statistika va vazirlik hisobotlari tayyorlash uchun',
    approvalNote: 'Bosh buxgalteriya talabi to‘liq qondirildi va tovarlar to‘liq topshirildi.',
    requesterId: molAcc.id,
    departmentId: accountingDept.id,
    approvedById: warehouseChief.id,
    createdAt: new Date('2026-09-02T09:00:00Z'),
    items: [
      { itemId: itemPaper.id, requestedQty: 20, approvedQty: 20 },
      { itemId: itemFolders.id, requestedQty: 15, approvedQty: 15 },
      { itemId: itemToner05A.id, requestedQty: 2, approvedQty: 2 },
    ],
  });

  // 8. FULFILLED: Dasturiy injiniring kafedrasi o'quv yili boshlanishi
  await getOrCreateRequest({
    requestNumber: 'REQ-2026-108',
    purpose: 'Dasturiy injiniring kafedrasi 2026/2027 o‘quv yili boshlanishi uchun o‘quv-uslubiy majmualar',
    status: RequestStatus.FULFILLED,
    isOverQuota: false,
    specialApprovalNeeded: false,
    notes: 'Sillabuslar va reyting daftarchalari',
    approvalNote: 'O‘quv yili boshlanish rejasi asosida to‘liq tarqatildi.',
    requesterId: molHead.id,
    departmentId: seChair.id,
    approvedById: warehouseChief.id,
    createdAt: new Date('2026-09-03T14:00:00Z'),
    items: [
      { itemId: itemPaper.id, requestedQty: 8, approvedQty: 8 },
      { itemId: itemToner.id, requestedQty: 2, approvedQty: 2 },
      { itemId: itemMarkers.id, requestedQty: 4, approvedQty: 4 },
    ],
  });

  // 9. FULFILLED: Inson resurslari va kadrlar bo'limi
  await getOrCreateRequest({
    requestNumber: 'REQ-2026-109',
    purpose: 'Inson resurslari va kadrlar bo‘limi yangi qabul qilingan professor-o‘qituvchilar shaxsiy yig‘majildlari',
    status: RequestStatus.FULFILLED,
    isOverQuota: false,
    specialApprovalNeeded: false,
    notes: 'Kadrlar buyruqlari va shartnomalari uchun',
    approvalNote: 'Kadrlar bo‘limiga buyurtma bo‘yicha to‘liq topshirildi.',
    requesterId: admin.id,
    departmentId: hrDept.id,
    approvedById: warehouseChief.id,
    createdAt: new Date('2026-09-04T11:30:00Z'),
    items: [
      { itemId: itemPaper.id, requestedQty: 9, approvedQty: 9 },
      { itemId: itemFolders.id, requestedQty: 11, approvedQty: 11 },
    ],
  });

  // 10. REJECTED: Fizika kafedrasi rad etilgan talabnomasi
  await getOrCreateRequest({
    requestNumber: 'REQ-2026-110',
    purpose: 'Umumiy fizika kafedrasi uchun rejalashtirilmagan qo‘shimcha materiallar',
    status: RequestStatus.REJECTED,
    isOverQuota: false,
    specialApprovalNeeded: false,
    notes: 'Qo‘shimcha talabnoma sifatida kiritilgan',
    approvalNote: 'Rad etildi: Kafedraning oylik limitida yetarli qoldiq mavjud emas va qo‘shimcha zarurat yuzasidan bildirishnoma taqdim etilmagan.',
    requesterId: assistentBekzod.id,
    departmentId: physChair.id,
    approvedById: molPhys.id,
    createdAt: new Date('2026-09-05T15:30:00Z'),
    items: [
      { itemId: itemPaper.id, requestedQty: 10, approvedQty: 0 },
      { itemId: itemToner.id, requestedQty: 3, approvedQty: 0 },
    ],
  });

  // 11. CANCELLED: Moliya kafedrasi bekor qilingan talabnoma
  await getOrCreateRequest({
    requestNumber: 'REQ-2026-111',
    purpose: 'Moliya kafedrasi o‘quv seminari uchun test blankalari (seminar boshqa muddatga qoldirildi)',
    status: RequestStatus.CANCELLED,
    isOverQuota: false,
    specialApprovalNeeded: false,
    notes: 'Tadbir kechiktirilganligi sababli talabgor tomonidan qaytarib olindi',
    approvalNote: null,
    requesterId: molFin.id,
    departmentId: finChair.id,
    approvedById: null,
    createdAt: new Date('2026-09-06T10:00:00Z'),
    items: [
      { itemId: itemPaper.id, requestedQty: 5, approvedQty: null },
    ],
  });

  // 12. FULFILLED: Fizika laboratoriyasi
  await getOrCreateRequest({
    requestNumber: 'REQ-2026-112',
    purpose: 'Umumiy fizika va optika tajriba laboratoriyasi (215-xona) jurnallari va registratorlar',
    status: RequestStatus.FULFILLED,
    isOverQuota: false,
    specialApprovalNeeded: false,
    notes: 'Fizika laboratoriya sinovlari va xavfsizlik jurnallari uchun',
    approvalNote: 'Ombor mudiri tomonidan to‘liq ta’minlandi.',
    requesterId: molPhys.id,
    departmentId: physChair.id,
    approvedById: warehouseChief.id,
    createdAt: new Date('2026-09-07T13:00:00Z'),
    items: [
      { itemId: itemPaper.id, requestedQty: 4, approvedQty: 4 },
      { itemId: itemFolders.id, requestedQty: 5, approvedQty: 5 },
    ],
  });

  console.log('Step 4 successfully completed!');

  // =========================================================================
  // 13. TA’MIRLASH SERVIS JURNALI (7 TA REPAIR RECORD)
  // =========================================================================
  console.log('13. Seeding 7 comprehensive repair records across all statuses...');

  const targetInvs = [
    'INV-2026-0002',
    'INV-2026-0006',
    'INV-2026-0008',
    'INV-2026-0015',
    'INV-2026-0021',
    'INV-2026-0022',
    'INV-2026-0044',
    'INV-2026-0045',
    'INV-2026-0046',
  ];
  const foundAssets = await prisma.itemInstance.findMany({
    where: { inventoryNumber: { in: targetInvs } },
  });
  const assetByInv = new Map(foundAssets.map((a) => [a.inventoryNumber, a]));

  const a0002 = assetByInv.get('INV-2026-0002')!;
  const a0006 = assetByInv.get('INV-2026-0006')!;
  const a0008 = assetByInv.get('INV-2026-0008')!;
  const a0015 = assetByInv.get('INV-2026-0015')!;
  const a0021 = assetByInv.get('INV-2026-0021')!;
  const a0022 = assetByInv.get('INV-2026-0022')!;
  const a0044 = assetByInv.get('INV-2026-0044')!;
  const a0045 = assetByInv.get('INV-2026-0045')!;
  const a0046 = assetByInv.get('INV-2026-0046')!;

  // 1. PENDING: 304-lab noutbuk klaviatura nosozligi
  await getOrCreateRepairRecord({
    repairNumber: 'REP-2026-0001',
    assetId: a0006.id,
    issueDescription: 'Klaviaturadagi bir nechta tugmalar (Enter, Space, Backspace) ishlamay qolgan, suyuqlik to‘kilgan bo‘lishi mumkin',
    status: RepairStatus.PENDING,
    serviceProvider: 'Universitet ATM ichki ustaxonasi',
    cost: null,
    startDate: null,
    completionDate: null,
    actNumber: null,
    notes: 'Dars jarayoniga xalal bermaslik uchun laboratoriya mudiri tomonidan ta’mirlash arizasi berildi',
    requestedById: employee.id,
    approvedById: null,
    createdAt: new Date('2026-09-12T11:20:00Z'),
  });

  // 2. PENDING: Noutbuk akkumulyator nosozligi
  await getOrCreateRepairRecord({
    repairNumber: 'REP-2026-0002',
    assetId: a0008.id,
    issueDescription: 'Akkumulyator batareyasi 10 daqiqadan ortiq quvvat ushlamayapti, faqat doimiy tarmoqqa ulangan holda ishlaydi',
    status: RepairStatus.PENDING,
    serviceProvider: 'Universitet ATM ichki ustaxonasi',
    cost: null,
    startDate: null,
    completionDate: null,
    actNumber: null,
    notes: 'Kafedra mudiri roziligi bilan batareyani almashtirish so‘ralgan',
    requestedById: employee.id,
    approvedById: null,
    createdAt: new Date('2026-09-13T15:45:00Z'),
  });

  // 3. IN_REPAIR: Dell monitor matritsa shleyfi
  await getOrCreateRepairRecord({
    repairNumber: 'REP-2026-0003',
    assetId: a0044.id,
    issueDescription: 'Ekranda vertikal qizil va ko‘k chiziqlar paydo bo‘lgan, monitor matritsa shleyfi shikastlangan',
    status: RepairStatus.IN_REPAIR,
    serviceProvider: 'TechService Toshkent MCHJ',
    cost: 480000,
    startDate: new Date('2026-09-08T10:00:00Z'),
    completionDate: null,
    actNumber: null,
    notes: 'Ehtiyot qism (original LVDS shleyf) buyurtma qilingan, 2 ish kuni ichida yetkaziladi',
    requestedById: teacher2.id,
    approvedById: warehouseChief.id,
    createdAt: new Date('2026-09-07T09:30:00Z'),
  });

  // 4. IN_REPAIR: Epson proyektor lampasi
  await getOrCreateRepairRecord({
    repairNumber: 'REP-2026-0004',
    assetId: a0045.id,
    issueDescription: 'Proyektor lampasi resursi (5000 soat) tugagan, sovutish ventilyatori qattiq shovqin chiqarib o‘chib qolmoqda',
    status: RepairStatus.IN_REPAIR,
    serviceProvider: 'SoftLine Rasmiy Servis Markazi',
    cost: 1350000,
    startDate: new Date('2026-09-05T11:00:00Z'),
    completionDate: null,
    actNumber: null,
    notes: 'Epson ELPLP96 original lampasi va sovutish kulerini almashtirish ishlari ketyapti',
    requestedById: molHead.id,
    approvedById: warehouseChief.id,
    createdAt: new Date('2026-09-04T14:00:00Z'),
  });

  // 5. COMPLETED: HP ProDesk quvvat bloki ta'mirlangan
  await getOrCreateRepairRecord({
    repairNumber: 'REP-2026-0005',
    assetId: a0022.id,
    issueDescription: 'Elektr tarmog‘idagi kuchlanish sakrashi oqibatida quvvat bloki (350W ATX) ishdan chiqqan',
    status: RepairStatus.COMPLETED,
    serviceProvider: 'Universitet ATM ichki ustaxonasi',
    cost: 320000,
    startDate: new Date('2026-08-20T09:00:00Z'),
    completionDate: new Date('2026-08-23T16:00:00Z'),
    actNumber: 'AKT-REP-2026-018',
    notes: 'Yangi original HP quvvat bloki o‘rnatildi, kompyuter 24 soatlik stress-testdan o‘tkazildi va foydalanishga topshirildi',
    requestedById: teacher2.id,
    approvedById: warehouseChief.id,
    createdAt: new Date('2026-08-19T10:00:00Z'),
  });

  // 6. COMPLETED: Proyektor optikasi profilaktikasi
  await getOrCreateRepairRecord({
    repairNumber: 'REP-2026-0006',
    assetId: a0006.id,
    issueDescription: 'Noutbuk ichki sovutish tizimi va ventilyatorlari chang bosishi sababli qizib ketgan',
    status: RepairStatus.COMPLETED,
    serviceProvider: 'Universitet ATM ichki ustaxonasi',
    cost: 150000,
    startDate: new Date('2026-08-25T10:00:00Z'),
    completionDate: new Date('2026-08-26T14:30:00Z'),
    actNumber: 'AKT-REP-2026-022',
    notes: 'Termopasta yangilandi, ventilyator tozalandi va profilaktika qilindi',
    requestedById: molHead.id,
    approvedById: admin.id,
    createdAt: new Date('2026-08-24T16:30:00Z'),
  });

  // 7. UNREPAIRABLE: Eski HP kompyuter diagnostikasi
  await getOrCreateRepairRecord({
    repairNumber: 'REP-2026-0007',
    assetId: a0046.id,
    issueDescription: 'Tizim platasi (Motherboard) mikrosxemalari va protsessor soketi qisqa tutashuvdan kuygan',
    status: RepairStatus.UNREPAIRABLE,
    serviceProvider: 'TechService Toshkent MCHJ',
    cost: 80000,
    startDate: new Date('2026-08-10T10:00:00Z'),
    completionDate: new Date('2026-08-14T12:00:00Z'),
    actNumber: 'AKT-DIAG-2026-009',
    notes: 'Texnik ekspertiza xulosasiga ko‘ra qurilmani tiklash iqtisodiy samarasiz deb topildi. Hisobdan chiqarish (OS-4) komissiyasiga yuborildi',
    requestedById: docentValiyev.id,
    approvedById: warehouseChief.id,
    createdAt: new Date('2026-08-09T11:00:00Z'),
  });

  // =========================================================================
  // 14. HISOBDAN CHIQARISH (SPISANIE OS-4) VA KOMISSIYA OVOZLARI
  // =========================================================================
  console.log('14. Seeding 4 comprehensive write-off requests (OS-4) and commission member votes...');

  // 1. APPROVED: Eski HP kompyuter to'liq tasdiqlangan (OS-4)
  await getOrCreateWriteOffRequest({
    actNumber: 'OS4-2026-0001',
    assetId: a0046.id,
    reason: '100% jismoniy va ma’naviy eskirish, ta’mirlab bo‘lmaydigan darajada plata va protsessor kuyishi (AKT-DIAG-2026-009)',
    technicalConclusion: 'Qurilmaning tizim platasi qisqa tutashuv oqibatida butunlay yaroqsiz holga kelgan. Amortizatsiya muddati to‘liq tugagan (6 yil foydalanilgan). Qayta tiklash xarajati qurilma qoldiq qiymatidan yuqori bo‘lganligi sababli hisobdan chiqarish va utilizatsiyaga topshirish tavsiya etiladi.',
    status: WriteOffStatus.APPROVED,
    approvedAt: new Date('2026-08-28T15:00:00Z'),
    createdById: molAcc.id,
    createdAt: new Date('2026-08-18T10:00:00Z'),
    members: [
      {
        userId: admin.id,
        roleName: 'Komissiya raisi o‘rinbosari (ATM boshlig‘i)',
        vote: VoteStatus.APPROVED,
        comment: 'Texnik ekspertiza xulosasini to‘liq tasdiqlayman. Butlovchi qismlar qayta foydalanishga yaroqsiz.',
        votedAt: new Date('2026-08-20T11:00:00Z'),
      },
      {
        userId: molAcc.id,
        roleName: 'Komissiya a’zosi (Bosh hisobchi / Kafedra mudiri)',
        vote: VoteStatus.APPROVED,
        comment: 'Buxgalteriya balansidan qoldiq qiymati 0 so‘m bo‘lganligi sababli chiqarish ma’qullandi.',
        votedAt: new Date('2026-08-21T14:30:00Z'),
      },
      {
        userId: warehouseChief.id,
        roleName: 'Komissiya a’zosi (Bosh ombor mudiri)',
        vote: VoteStatus.APPROVED,
        comment: 'Utilizatsiya uchun markaziy ombor utilizatsiya bo‘limiga qabul qilindi.',
        votedAt: new Date('2026-08-22T09:15:00Z'),
      },
      {
        userId: auditor.id,
        roleName: 'Komissiya a’zosi (Ichki audit inspektori)',
        vote: VoteStatus.APPROVED,
        comment: 'Tekshirildi, hisobdan chiqarish tartibi OTM moliyaviy nizomiga to‘liq mos keladi.',
        votedAt: new Date('2026-08-25T16:00:00Z'),
      },
    ],
  });

  // 2. IN_REVIEW: Valberg seyfi yoki uskuna (qisman ovoz berilgan)
  await getOrCreateWriteOffRequest({
    actNumber: 'OS4-2026-0002',
    assetId: a0021.id,
    reason: 'Qulflash mexanizmi va eshik qotishmasi sinishi, yong‘inga chidamlilik qatlami buzilishi',
    technicalConclusion: 'Seyfning ichki xavfsizlik bolt mexanizmi to‘liq yorilgan, qulf almashtirish korpus yaxlitligini tiklamaydi. Maxfiy hujjatlarni saqlashga yaroqsiz deb topildi.',
    status: WriteOffStatus.IN_REVIEW,
    approvedAt: null,
    createdById: molHead.id,
    createdAt: new Date('2026-09-08T11:00:00Z'),
    members: [
      {
        userId: admin.id,
        roleName: 'Komissiya raisi o‘rinbosari (ATM boshlig‘i)',
        vote: VoteStatus.APPROVED,
        comment: 'Hujjatlar xavfsizligi talablariga javob bermaydi, hisobdan chiqarish maqsadga muvofiq.',
        votedAt: new Date('2026-09-09T14:00:00Z'),
      },
      {
        userId: molAcc.id,
        roleName: 'Komissiya a’zosi (Bosh hisobchi / Kafedra mudiri)',
        vote: VoteStatus.APPROVED,
        comment: 'Qoldiq balans qiymati tahlil qilindi, e’tiroz yo‘q.',
        votedAt: new Date('2026-09-10T10:30:00Z'),
      },
      {
        userId: warehouseChief.id,
        roleName: 'Komissiya a’zosi (Bosh ombor mudiri)',
        vote: VoteStatus.PENDING,
        comment: null,
        votedAt: null,
      },
      {
        userId: auditor.id,
        roleName: 'Komissiya a’zosi (Ichki audit inspektori)',
        vote: VoteStatus.PENDING,
        comment: null,
        votedAt: null,
      },
    ],
  });

  // 3. IN_REVIEW: O'quv partalari to'plami (barcha a'zolar ko'rib chiqmoqda)
  await getOrCreateWriteOffRequest({
    actNumber: 'OS4-2026-0003',
    assetId: a0015.id,
    reason: 'Metall karkas payvand choklarining sinishi va yog‘och qoplamalarning to‘liq yemirilishi',
    technicalConclusion: 'Konstruksiya mexanik mustahkamligini yo‘qotgan, talabalar xavfsizligiga tahdid solishi mumkin. Qayta ta’mirlash tavsiya etilmaydi.',
    status: WriteOffStatus.IN_REVIEW,
    approvedAt: null,
    createdById: molHead.id,
    createdAt: new Date('2026-09-11T15:00:00Z'),
    members: [
      {
        userId: admin.id,
        roleName: 'Komissiya raisi o‘rinbosari (ATM boshlig‘i)',
        vote: VoteStatus.PENDING,
        comment: null,
        votedAt: null,
      },
      {
        userId: molAcc.id,
        roleName: 'Komissiya a’zosi (Bosh hisobchi / Kafedra mudiri)',
        vote: VoteStatus.PENDING,
        comment: null,
        votedAt: null,
      },
      {
        userId: warehouseChief.id,
        roleName: 'Komissiya a’zosi (Bosh ombor mudiri)',
        vote: VoteStatus.PENDING,
        comment: null,
        votedAt: null,
      },
      {
        userId: auditor.id,
        roleName: 'Komissiya a’zosi (Ichki audit inspektori)',
        vote: VoteStatus.PENDING,
        comment: null,
        votedAt: null,
      },
    ],
  });

  // 4. REJECTED: Noutbuk bo'yicha berilgan asossiz ariza rad etildi
  await getOrCreateWriteOffRequest({
    actNumber: 'OS4-2026-0004',
    assetId: a0002.id,
    reason: 'Operatsion tizim yuklanmasligi va noutbuk sekin ishlashi sababli hisobdan chiqarish taklif etilgan',
    technicalConclusion: 'Dastlabki ko‘rikda SSD nosozligi gumon qilingan.',
    status: WriteOffStatus.REJECTED,
    approvedAt: null,
    createdById: employee.id,
    createdAt: new Date('2026-09-01T10:00:00Z'),
    members: [
      {
        userId: admin.id,
        roleName: 'Komissiya raisi o‘rinbosari (ATM boshlig‘i)',
        vote: VoteStatus.REJECTED,
        comment: 'Rad etildi: Faqatgina SSD xotirasini almashtirish va tizimni qayta o‘rnatish kifoya. Qurilma soz holatda ishlay oladi.',
        votedAt: new Date('2026-09-03T11:00:00Z'),
      },
      {
        userId: auditor.id,
        roleName: 'Komissiya a’zosi (Ichki audit inspektori)',
        vote: VoteStatus.REJECTED,
        comment: 'Asossiz so‘rov: Amortizatsiya muddati tugamagan, hisobdan chiqarish qonunchilikka zid.',
        votedAt: new Date('2026-09-03T14:20:00Z'),
      },
      {
        userId: molAcc.id,
        roleName: 'Komissiya a’zosi (Bosh hisobchi / Kafedra mudiri)',
        vote: VoteStatus.REJECTED,
        comment: 'Ta’mirlash ustaxonasiga yo‘naltirilsin.',
        votedAt: new Date('2026-09-04T09:00:00Z'),
      },
      {
        userId: warehouseChief.id,
        roleName: 'Komissiya a’zosi (Bosh ombor mudiri)',
        vote: VoteStatus.REJECTED,
        comment: 'Omborda yangi NVMe SSD zaxirasi mavjud, ehtiyot qism beriladi.',
        votedAt: new Date('2026-09-04T12:00:00Z'),
      },
    ],
  });

  console.log('Step 5 successfully completed!');

  // =========================================================================
  // 15. QR AUDIT SESSIYALARI VA SKANER NATIJALARI (3 TA AUDIT VA 18 TA SKAN)
  // =========================================================================
  console.log('15. Seeding 3 comprehensive inventory audits and scan records...');

  // 1. COMPLETED: 304-laboratoriya to'liq inventarizatsiyasi
  await getOrCreateInventoryAudit({
    auditNumber: 'AUD-2026-0001',
    title: '304-Dasturiy injiniring o‘quv laboratoriyasi to‘liq inventarizatsiyasi',
    status: AuditStatus.COMPLETED,
    notes: 'Laboratoriyadagi barcha asosiy vositalar tekshirildi: 10 ta o‘z joyida, 1 ta ta’mirda (kamomad), 1 ta boshqa xonadan keltirilgan',
    startedAt: new Date('2026-09-01T09:00:00Z'),
    completedAt: new Date('2026-09-01T17:30:00Z'),
    createdById: auditor.id,
    roomId: room304.id,
    records: [
      {
        itemInstanceId: a0006.id,
        expectedRoomId: room304.id,
        foundRoomId: room304.id,
        status: AuditRecordStatus.MATCHED,
        scannedAt: new Date('2026-09-01T09:15:00Z'),
        notes: 'O‘z joyida topildi: ThinkPad noutbuki',
      },
      {
        itemInstanceId: a0008.id,
        expectedRoomId: room304.id,
        foundRoomId: room304.id,
        status: AuditRecordStatus.MATCHED,
        scannedAt: new Date('2026-09-01T09:20:00Z'),
        notes: 'O‘z joyida topildi: ThinkPad noutbuki',
      },
      {
        itemInstanceId: a0015.id,
        expectedRoomId: room304.id,
        foundRoomId: room304.id,
        status: AuditRecordStatus.MATCHED,
        scannedAt: new Date('2026-09-01T09:35:00Z'),
        notes: 'O‘z joyida topildi: Parta va stullar to‘plami',
      },
      {
        itemInstanceId: a0045.id,
        expectedRoomId: room304.id,
        foundRoomId: null,
        status: AuditRecordStatus.MISSING,
        scannedAt: new Date('2026-09-01T10:00:00Z'),
        notes: 'Xonada mavjud emas: Rasmiy servis markazida ta’mirda bo‘lganligi sababli kamomad sifatida qayd etildi',
      },
      {
        itemInstanceId: a0002.id,
        expectedRoomId: room306.id,
        foundRoomId: room304.id,
        status: AuditRecordStatus.RELOCATED,
        scannedAt: new Date('2026-09-01T10:15:00Z'),
        notes: 'Ko‘chirilgan: 306-o‘qituvchilar xonasidan 304-laboratoriyaga amaliy mashg‘ulot uchun o‘tkazilgan',
      },
    ],
  });

  // 2. IN_PROGRESS: 401-Kiberxavfsizlik o'quv zali auditi
  await getOrCreateInventoryAudit({
    auditNumber: 'AUD-2026-0002',
    title: '401-Kiberxavfsizlik o‘quv laboratoriyasi auditi',
    status: AuditStatus.IN_PROGRESS,
    notes: 'Kiberxavfsizlik kafedrasi auditoriyasi bo‘yicha tekshiruv davom etmoqda',
    startedAt: new Date('2026-09-12T10:00:00Z'),
    completedAt: null,
    createdById: chiefAuditor.id,
    roomId: room401.id,
    records: [
      {
        itemInstanceId: a0022.id,
        expectedRoomId: room401.id,
        foundRoomId: room401.id,
        status: AuditRecordStatus.MATCHED,
        scannedAt: new Date('2026-09-12T10:20:00Z'),
        notes: 'HP ProDesk kompyuteri o‘z joyida tekshirildi',
      },
      {
        itemInstanceId: a0044.id,
        expectedRoomId: room401.id,
        foundRoomId: null,
        status: AuditRecordStatus.MISSING,
        scannedAt: new Date('2026-09-12T10:45:00Z'),
        notes: 'Ta’mirda: Matritsa shleyfi nosozligi tufayli servis markazida',
      },
    ],
  });

  // 3. DRAFT: 201-Buxgalteriya rejaviy auditi
  await getOrCreateInventoryAudit({
    auditNumber: 'AUD-2026-0003',
    title: '201-Buxgalteriya hisobi kafedrasi rejaviy inventarizatsiyasi',
    status: AuditStatus.DRAFT,
    notes: '2026-yil 3-chorak rejaviy tekshiruvi uchun tayyorlangan sessiya',
    startedAt: null,
    completedAt: null,
    createdById: auditor.id,
    roomId: room201.id,
  });

  // =========================================================================
  // 16. TIZIM XAVFSIZLIK VA AMALLAR LOGI (SYSTEM AUDIT LOGS - 15 TA LOG)
  // =========================================================================
  console.log('16. Seeding 15 comprehensive system audit security logs...');

  const systemLogs = [
    {
      userId: admin.id,
      action: 'LOGIN',
      entity: 'User',
      entityId: admin.id,
      details: JSON.stringify({ ip: '192.168.1.10', method: 'PASSWORD', status: 'SUCCESS' }),
      ipAddress: '192.168.1.10',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      createdAt: new Date('2026-09-14T04:30:00Z'),
    },
    {
      userId: warehouseChief.id,
      action: 'STOCK_INCOMING',
      entity: 'StockMovement',
      entityId: 'MOV-2025-00001',
      details: JSON.stringify({ movementNumber: 'MOV-2025-00001', supplier: 'TechPro LLC', itemsCount: 3 }),
      ipAddress: '192.168.1.45',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
      createdAt: new Date('2026-09-10T09:15:00Z'),
    },
    {
      userId: warehouseChief.id,
      action: 'STOCK_OUTGOING',
      entity: 'StockMovement',
      entityId: 'MOV-2026-00004',
      details: JSON.stringify({ movementNumber: 'MOV-2026-00004', doc: 'OS2-2026-0001', toRoom: '304' }),
      ipAddress: '192.168.1.45',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
      createdAt: new Date('2026-09-10T11:20:00Z'),
    },
    {
      userId: employee.id,
      action: 'REQUEST_CREATE',
      entity: 'Request',
      entityId: 'REQ-2026-101',
      details: JSON.stringify({ requestNumber: 'REQ-2026-101', purpose: 'Laboratoriya amaliy mashg‘ulotlari' }),
      ipAddress: '192.168.2.33',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      createdAt: new Date('2026-09-12T09:30:00Z'),
    },
    {
      userId: molCyber.id,
      action: 'REQUEST_APPROVE',
      entity: 'Request',
      entityId: 'REQ-2026-103',
      details: JSON.stringify({ requestNumber: 'REQ-2026-103', status: 'APPROVED_BY_HEAD' }),
      ipAddress: '192.168.2.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      createdAt: new Date('2026-09-10T11:00:00Z'),
    },
    {
      userId: warehouseChief.id,
      action: 'REQUEST_FULFILL',
      entity: 'Request',
      entityId: 'REQ-2026-107',
      details: JSON.stringify({ requestNumber: 'REQ-2026-107', status: 'FULFILLED', recipient: 'Bosh buxgalteriya' }),
      ipAddress: '192.168.1.45',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
      createdAt: new Date('2026-09-02T09:00:00Z'),
    },
    {
      userId: molHead.id,
      action: 'TRANSFER_CREATE',
      entity: 'TransferAcceptance',
      entityId: a0006.id,
      details: JSON.stringify({ fromRoom: '304', toRoom: '306', asset: 'INV-2026-0006' }),
      ipAddress: '192.168.2.10',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      createdAt: new Date('2026-09-11T14:00:00Z'),
    },
    {
      userId: teacher2.id,
      action: 'REPAIR_REQUEST',
      entity: 'RepairRecord',
      entityId: 'REP-2026-0003',
      details: JSON.stringify({ repairNumber: 'REP-2026-0003', asset: 'INV-2026-0044', issue: 'Monitor matritsa nosozligi' }),
      ipAddress: '192.168.2.44',
      userAgent: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64)',
      createdAt: new Date('2026-09-07T09:30:00Z'),
    },
    {
      userId: warehouseChief.id,
      action: 'REPAIR_COMPLETE',
      entity: 'RepairRecord',
      entityId: 'REP-2026-0005',
      details: JSON.stringify({ repairNumber: 'REP-2026-0005', actNumber: 'AKT-REP-2026-018', cost: 320000 }),
      ipAddress: '192.168.1.45',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
      createdAt: new Date('2026-08-23T16:00:00Z'),
    },
    {
      userId: molAcc.id,
      action: 'WRITE_OFF_CREATE',
      entity: 'WriteOffRequest',
      entityId: 'OS4-2026-0001',
      details: JSON.stringify({ actNumber: 'OS4-2026-0001', asset: 'INV-2026-0046', reason: '100% amortizatsiya' }),
      ipAddress: '192.168.1.80',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      createdAt: new Date('2026-08-18T10:00:00Z'),
    },
    {
      userId: admin.id,
      action: 'WRITE_OFF_VOTE',
      entity: 'WriteOffMemberVote',
      entityId: 'OS4-2026-0001',
      details: JSON.stringify({ actNumber: 'OS4-2026-0001', vote: 'APPROVED', role: 'ATM boshlig‘i' }),
      ipAddress: '192.168.1.10',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      createdAt: new Date('2026-08-20T11:00:00Z'),
    },
    {
      userId: admin.id,
      action: 'QUOTA_UPDATE',
      entity: 'DepartmentQuota',
      entityId: cyberChair.id,
      details: JSON.stringify({ department: 'Kiberxavfsizlik', item: 'A4 Qog‘oz', limit: 10, period: '2026-09' }),
      ipAddress: '192.168.1.10',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      createdAt: new Date('2026-09-01T08:00:00Z'),
    },
    {
      userId: auditor.id,
      action: 'AUDIT_COMPLETE',
      entity: 'InventoryAudit',
      entityId: 'AUD-2026-0001',
      details: JSON.stringify({ auditNumber: 'AUD-2026-0001', matched: 10, missing: 1, relocated: 1 }),
      ipAddress: '192.168.1.55',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      createdAt: new Date('2026-09-01T17:30:00Z'),
    },
    {
      userId: admin.id,
      action: 'BACKUP_CREATE',
      entity: 'BackupRecord',
      entityId: 'uwms_backup_20260914_050000.sql.gz',
      details: JSON.stringify({ filename: 'uwms_backup_20260914_050000.sql.gz', size: '44.28 MB', type: 'MANUAL' }),
      ipAddress: '192.168.1.10',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      createdAt: new Date('2026-09-14T05:00:00Z'),
    },
    {
      userId: admin.id,
      action: 'EXPORT_EXCEL',
      entity: 'DashboardAnalytics',
      entityId: 'Universitet_Boshqaruv_Tahliliy_Balansi',
      details: JSON.stringify({ report: 'Universitet_Boshqaruv_Tahliliy_Balansi', format: 'XLSX' }),
      ipAddress: '192.168.1.10',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      createdAt: new Date('2026-09-14T05:20:00Z'),
    },
  ];

  for (const log of systemLogs) {
    const existing = await prisma.systemAuditLog.findFirst({
      where: {
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
      },
    });
    if (!existing) {
      await prisma.systemAuditLog.create({ data: log });
    }
  }

  // =========================================================================
  // 17. RAQAMLI MUHRLAR VA VERIFIKATSIYA (DOCUMENT STAMPS - 5 TA RASMIY AKT)
  // =========================================================================
  console.log('17. Seeding 5 official document verification stamps...');

  await getOrCreateDocumentStamp({
    docType: 'OS_1',
    docNumber: 'OS1-2025-0041',
    verificationHash: 'a7b9c1d3e5f702468ace13579bdf02468ace13579bdf02468ace13579bdf0246',
    title: 'Asosiy vositalarni qabul qilish-topshirish dalolatnomasi (OS-1)',
    signerName: 'Toshmatov Omon',
    signerRole: 'Bosh ombor mudiri',
    metadataJson: JSON.stringify({
      supplier: 'TechPro MCHJ',
      contract: 'SH-2025-412',
      totalSum: 185000000,
      itemsCount: 30,
      actDate: '2025-09-10',
    }),
    isValid: true,
    createdAt: new Date('2025-09-10T12:00:00Z'),
  });

  await getOrCreateDocumentStamp({
    docType: 'OS_2',
    docNumber: 'OS2-2026-0001',
    verificationHash: 'b8c0d2e4f60813579bdf02468ace13579bdf02468ace13579bdf02468ace1357',
    title: 'Asosiy vositalarni ichki ko‘chirish va tarqatish yukxati (OS-2)',
    signerName: 'Prof. Alimov Jasur',
    signerRole: 'Dasturiy injiniring kafedrasi mudiri',
    metadataJson: JSON.stringify({
      fromRoom: 'Ombor',
      toRoom: '304',
      receiver: 'Karimov Rustam',
      itemsCount: 15,
      actDate: '2026-01-20',
    }),
    isValid: true,
    createdAt: new Date('2026-01-20T11:30:00Z'),
  });

  await getOrCreateDocumentStamp({
    docType: 'INV_19',
    docNumber: 'INV19-2026-0001',
    verificationHash: 'c9d1e3f507192468ace13579bdf02468ace13579bdf02468ace13579bdf02468a',
    title: 'Asosiy vositalar inventarizatsiyasi solishtirma dalolatnomasi (INV-19)',
    signerName: 'Narzullayev Farhod',
    signerRole: 'Ichki audit bosh inspektori',
    metadataJson: JSON.stringify({
      auditNumber: 'AUD-2026-0001',
      room: '304',
      totalChecked: 12,
      matched: 10,
      missing: 1,
      relocated: 1,
      actDate: '2026-09-01',
    }),
    isValid: true,
    createdAt: new Date('2026-09-01T18:00:00Z'),
  });

  await getOrCreateDocumentStamp({
    docType: 'OS_4',
    docNumber: 'OS4-2026-0001',
    verificationHash: 'd0e2f40618203579bdf02468ace13579bdf02468ace13579bdf02468ace13579b',
    title: 'Asosiy vositalarni hisobdan chiqarish (tugatish) dalolatnomasi (OS-4)',
    signerName: 'Prof. Yoqubov Sardor',
    signerRole: 'Davlat komissiyasi vakili / Bosh hisobchi',
    metadataJson: JSON.stringify({
      asset: 'INV-2026-0046',
      model: 'HP ProDesk 400 G7',
      initialCost: 5400000,
      residualCost: 0,
      reason: '100% amortizatsiya va plata kuyishi',
      actDate: '2026-08-28',
    }),
    isValid: true,
    createdAt: new Date('2026-08-28T16:00:00Z'),
  });

  await getOrCreateDocumentStamp({
    docType: 'MOL_TRANSFER',
    docNumber: 'AKT-MOL-2026-01',
    verificationHash: 'e1f305172931468ace13579bdf02468ace13579bdf02468ace13579bdf02468ac',
    title: 'Moddiy javobgarlikni yangi shaxsga yalpi topshirish dalolatnomasi',
    signerName: 'Toshmatov Omon',
    signerRole: 'Bosh ombor mudiri',
    metadataJson: JSON.stringify({
      oldMOL: 'Toshmatov Omon',
      newMOL: 'Ergashev Bobur',
      assetsCount: 49,
      actDate: '2026-09-14',
    }),
    isValid: true,
    createdAt: new Date('2026-09-14T08:00:00Z'),
  });

  // =========================================================================
  // 18. MA'LUMOTLAR BAZASI ZAXIRA NUSXALARI (BACKUP RECORDS - 4 TA ZAXIRA)
  // =========================================================================
  console.log('18. Seeding 4 comprehensive database backup records...');

  await getOrCreateBackupRecord({
    filename: 'uwms_backup_20260901_020000.sql.gz',
    filePath: '/var/backups/uwms/uwms_backup_20260901_020000.sql.gz',
    fileSizeBytes: 42500000n,
    backupType: BackupType.AUTOMATIC,
    status: BackupStatus.COMPLETED,
    checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    notes: 'Haftalik rejaviy avtomatik to‘liq zaxira',
    triggeredById: admin.id,
    createdAt: new Date('2026-09-01T02:00:00Z'),
    completedAt: new Date('2026-09-01T02:04:15Z'),
  });

  await getOrCreateBackupRecord({
    filename: 'uwms_backup_20260908_020000.sql.gz',
    filePath: '/var/backups/uwms/uwms_backup_20260908_020000.sql.gz',
    fileSizeBytes: 43150000n,
    backupType: BackupType.AUTOMATIC,
    status: BackupStatus.COMPLETED,
    checksum: 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
    notes: 'Haftalik rejaviy avtomatik to‘liq zaxira',
    triggeredById: admin.id,
    createdAt: new Date('2026-09-08T02:00:00Z'),
    completedAt: new Date('2026-09-08T02:04:22Z'),
  });

  await getOrCreateBackupRecord({
    filename: 'uwms_backup_20260914_050000.sql.gz',
    filePath: '/var/backups/uwms/uwms_backup_20260914_050000.sql.gz',
    fileSizeBytes: 44280000n,
    backupType: BackupType.MANUAL,
    status: BackupStatus.COMPLETED,
    checksum: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    notes: 'Yangi 2026/2027 o‘quv yili boshlanishi oldidan administrator tomonidan olingan to‘liq snapshot',
    triggeredById: admin.id,
    createdAt: new Date('2026-09-14T05:00:00Z'),
    completedAt: new Date('2026-09-14T05:05:10Z'),
  });

  await getOrCreateBackupRecord({
    filename: 'uwms_backup_20260914_100000.sql.gz',
    filePath: '/var/backups/uwms/uwms_backup_20260914_100000.sql.gz',
    fileSizeBytes: 44300000n,
    backupType: BackupType.MANUAL,
    status: BackupStatus.RESTORED,
    checksum: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d',
    notes: 'Zaxira nusxasini qayta tiklash (Disaster Recovery Drill) muvaffaqiyatli sinovdan o‘tkazildi',
    triggeredById: admin.id,
    createdAt: new Date('2026-09-14T10:00:00Z'),
    completedAt: new Date('2026-09-14T10:06:40Z'),
  });

  // =========================================================================
  // 19. TIZIM BILDIRISHNOMALARI (NOTIFICATIONS - 8 TA XABARNOMA)
  // =========================================================================
  console.log('19. Seeding 8 comprehensive system notifications across roles...');

  await getOrCreateNotification({
    userId: admin.id,
    title: 'Zaxira nusxasi yaratildi',
    message: 'Tizimning to‘liq zaxira nusxasi muvaffaqiyatli saqlandi: uwms_backup_20260914_050000.sql.gz (44.28 MB)',
    type: NotificationType.SUCCESS,
    link: '/backups',
    isRead: false,
    createdAt: new Date('2026-09-14T05:06:00Z'),
  });

  await getOrCreateNotification({
    userId: warehouseChief.id,
    title: 'Yangi tasdiqlangan talabnoma',
    message: 'REQ-2026-103 talabnomasi kafedra tomonidan tasdiqlandi. Ombordan chiqarishga ruxsat berildi.',
    type: NotificationType.REQUEST,
    link: '/requests',
    isRead: false,
    createdAt: new Date('2026-09-10T11:05:00Z'),
  });

  await getOrCreateNotification({
    userId: molHead.id,
    title: 'Laboratoriya inventarizatsiyasi yakunlandi',
    message: '304-Dasturiy injiniring o‘quv laboratoriyasi auditi muvaffaqiyatli yakunlandi. INV-19 dalolatnomasi imzolashga tayyor.',
    type: NotificationType.AUDIT,
    link: '/audit',
    isRead: true,
    createdAt: new Date('2026-09-01T18:05:00Z'),
  });

  await getOrCreateNotification({
    userId: molCyber.id,
    title: 'Oylik sarf kvotasi chegaradan oshdi',
    message: 'Diqqat! Kafedrangizning A4 qog‘oz bo‘yicha oylik sarf kvotasi 120% ga yetdi (10 limitdan 12 pachka sarflandi).',
    type: NotificationType.QUOTA,
    link: '/quotas',
    isRead: false,
    createdAt: new Date('2026-09-11T09:00:00Z'),
  });

  await getOrCreateNotification({
    userId: auditor.id,
    title: 'Spisanie komissiyasi yig‘ilishi',
    message: 'OS4-2026-0002 va OS4-2026-0003 hisobdan chiqarish arizalari ko‘rib chiqish uchun taqdim etildi.',
    type: NotificationType.WRITE_OFF,
    link: '/write-offs',
    isRead: false,
    createdAt: new Date('2026-09-11T16:00:00Z'),
  });

  await getOrCreateNotification({
    userId: teacher2.id,
    title: 'Kompyuter ta’mirdan qaytdi',
    message: '401-xona HP ProDesk kompyuteri quvvat bloki ta’mirlanib, 24 soatlik sinovdan so‘ng ishga topshirildi (AKT-REP-2026-018).',
    type: NotificationType.REPAIR,
    link: '/repairs',
    isRead: true,
    createdAt: new Date('2026-08-23T16:30:00Z'),
  });

  await getOrCreateNotification({
    userId: molAcc.id,
    title: 'OS-4 hisobdan chiqarish akti tasdiqlandi',
    message: 'Eski HP ProDesk kompyuteri (INV-2026-0046) bo‘yicha hisobdan chiqarish va utilizatsiya akti to‘liq tasdiqlandi.',
    type: NotificationType.SUCCESS,
    link: '/write-offs',
    isRead: true,
    createdAt: new Date('2026-08-28T16:30:00Z'),
  });

  await getOrCreateNotification({
    userId: warehouseChief.id,
    title: 'Kam qolgan sarf tovarlari ogohlantirishi',
    message: 'Markaziy omborda HP 85A va HP 05A toner kartridjlari minimal xavfsiz chegaradan kam qoldi (Kritik LOW). Yangi xarid buyurtmasi tavsiya etiladi.',
    type: NotificationType.WARNING,
    link: '/warehouse',
    isRead: false,
    createdAt: new Date('2026-09-14T08:30:00Z'),
  });

  console.log('Step 6 successfully completed! All modules populated with rich real database records.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

