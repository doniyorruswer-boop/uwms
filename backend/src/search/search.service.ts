import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchQueryDto, SearchResultItemDto } from './dto/search.dto';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private readonly prisma: PrismaService) {}

  async search(query: SearchQueryDto, user: any): Promise<SearchResultItemDto[]> {
    const rawTerm = query.q?.trim();
    if (!rawTerm || rawTerm.length < 2) {
      return [];
    }

    const limit = Math.max(1, Math.min(50, Number(query.limit || 20)));

    const requestRoleFilter: any = {};
    if (user && user.role !== 'SUPER_ADMIN') {
      if (user.role === 'EMPLOYEE') {
        requestRoleFilter.requesterId = user.id;
      } else if (user.role === 'MOL' && user.departmentId) {
        requestRoleFilter.OR = [
          { requesterId: user.id },
          { departmentId: user.departmentId },
        ];
      }
    }

    const [assets, rooms, users, requests] = await Promise.all([
      // 1. Asosiy vositalar (ItemInstance)
      this.prisma.itemInstance.findMany({
        where: {
          OR: [
            { inventoryNumber: { contains: rawTerm, mode: 'insensitive' } },
            { serialNumber: { contains: rawTerm, mode: 'insensitive' } },
            { item: { name: { contains: rawTerm, mode: 'insensitive' }, deletedAt: null } },
          ],
        },
        include: {
          item: true,
          room: { include: { department: true } },
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),

      // 2. Xonalar (Room)
      this.prisma.room.findMany({
        where: {
          deletedAt: null,
          OR: [
            { number: { contains: rawTerm, mode: 'insensitive' } },
            { name: { contains: rawTerm, mode: 'insensitive' } },
          ],
        },
        include: {
          department: true,
        },
        take: 6,
        orderBy: { number: 'asc' },
      }),

      // 3. Foydalanuvchilar (User)
      this.prisma.user.findMany({
        where: {
          deletedAt: null,
          OR: [
            { fullName: { contains: rawTerm, mode: 'insensitive' } },
            { username: { contains: rawTerm, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          fullName: true,
          username: true,
          role: true,
          department: { select: { name: true } },
        },
        take: 6,
        orderBy: { fullName: 'asc' },
      }),

      // 4. Talabnomalar (Request) - Multi-tenant / Role Izolyatsiyasi
      this.prisma.request.findMany({
        where: {
          AND: [
            {
              OR: [
                { requestNumber: { contains: rawTerm, mode: 'insensitive' } },
                { purpose: { contains: rawTerm, mode: 'insensitive' } },
              ],
            },
            requestRoleFilter,
          ],
        },
        include: {
          requester: { select: { fullName: true } },
          department: true,
        },
        take: 6,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const results: SearchResultItemDto[] = [];

    // 1. Aktivlar
    for (const a of assets) {
      const loc = a.room
        ? `${a.room.number}-xona (${a.room.name})`
        : 'Ombor';
      results.push({
        type: 'ASSET',
        id: a.id,
        title: `${a.item?.name || 'Asosiy vosita'} (${a.inventoryNumber})`,
        subtitle: `${loc} • Holati: ${a.status} • Manba: ${a.fundingSource}`,
        href: `/assets?search=${encodeURIComponent(a.inventoryNumber)}`,
        badge: a.inventoryNumber,
      });
    }

    // 2. Xonalar
    for (const r of rooms) {
      results.push({
        type: 'ROOM',
        id: r.id,
        title: `${r.number}-xona: ${r.name}`,
        subtitle: `${r.department?.name || 'Taqsimlanmagan'} • Bino: ${r.building}, ${r.floor}-qavat`,
        href: `/organization?roomId=${r.id}`,
        badge: `${r.number}-xona`,
      });
    }

    // 3. Talabnomalar
    for (const req of requests) {
      results.push({
        type: 'REQUEST',
        id: req.id,
        title: `Talabnoma № ${req.requestNumber}`,
        subtitle: `${req.purpose} • So‘rovchi: ${req.requester?.fullName || '—'} • Holati: ${req.status}`,
        href: `/requests?search=${encodeURIComponent(req.requestNumber)}`,
        badge: req.requestNumber,
      });
    }

    // 4. Foydalanuvchilar
    for (const u of users) {
      results.push({
        type: 'USER',
        id: u.id,
        title: `${u.fullName} (@${u.username})`,
        subtitle: `Rol: ${u.role} • Bo‘lim: ${u.department?.name || 'Universitet'}`,
        href: `/users?search=${encodeURIComponent(u.username)}`,
        badge: u.role,
      });
    }

    return results.slice(0, limit);
  }
}
