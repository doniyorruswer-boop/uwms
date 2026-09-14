import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BackupsService } from './backups.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleType } from '@prisma/client';
import { CreateBackupDto, RestoreBackupDto, QueryBackupDto } from './dto/backup.dto';
import { Response } from 'express';

@ApiTags('Backups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/backups')
export class BackupsController {
  constructor(private readonly backupsService: BackupsService) {}

  @Get()
  @Roles(RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Barcha zaxira nusxalari ro‘yxati (Pagination, Filter)' })
  async findAll(@Query() query: QueryBackupDto) {
    return this.backupsService.findAll(query);
  }

  @Get('stats')
  @Roles(RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Zaxira nusxalari umumiy statistikasi' })
  async getStats() {
    return this.backupsService.getStats();
  }

  @Post()
  @Roles(RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Yangi zaxira nusxasi yaratish' })
  async createBackup(@Body() body: CreateBackupDto, @CurrentUser() user: any) {
    return this.backupsService.createBackup(body, user?.id);
  }

  @Post(':id/restore')
  @Roles(RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Zaxira nusxasidan bazani tiklash' })
  async restoreBackup(
    @Param('id') id: string,
    @Body() body: RestoreBackupDto,
    @CurrentUser() user: any,
  ) {
    return this.backupsService.restoreBackup(id, body.confirmation, user?.id);
  }

  @Delete(':id')
  @Roles(RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Zaxira nusxasini o‘chirish' })
  async deleteBackup(@Param('id') id: string, @CurrentUser() user: any) {
    return this.backupsService.deleteBackup(id, user?.id);
  }

  @Get(':id/download')
  @Roles(RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Zaxira faylini yuklab olish' })
  async downloadBackup(@Param('id') id: string, @Res() res: Response) {
    const { filePath, filename } = await this.backupsService.getBackupFile(id);
    return res.download(filePath, filename);
  }
}
