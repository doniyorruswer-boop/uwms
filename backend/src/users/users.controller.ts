import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto, ToggleStatusDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleType } from '@prisma/client';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('permissions/catalog')
  @Roles(RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Tizimdagi ruxsatlar katalogi va standart rol shablonlarini olish' })
  async getPermissionsCatalog() {
    return this.usersService.getPermissionsCatalog();
  }

  @Get(':id/permissions')
  @Roles(RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Foydalanuvchining shaxsiy huquqlari va ruxsatlarini olish' })
  async getUserPermissions(@Param('id') id: string) {
    return this.usersService.getUserPermissions(id);
  }

  @Put(':id/permissions')
  @Roles(RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Foydalanuvchi huquqlari va ruxsatlarini yangilash' })
  async updateUserPermissions(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionsDto,
    @Request() req: any,
  ) {
    return this.usersService.updateUserPermissions(id, dto, req.user.id);
  }

  @Get()
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.RECTOR,
    RoleType.VICE_RECTOR_FINANCE,
    RoleType.CHIEF_ACCOUNTANT,
    RoleType.HEAD_WAREHOUSE,
    RoleType.AUDITOR,
  )
  @ApiOperation({ summary: 'Foydalanuvchilar va xodimlar ro‘yxatini olish (Qidiruv, filtrlar va paginatsiya)' })
  async findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.RECTOR,
    RoleType.VICE_RECTOR_FINANCE,
    RoleType.CHIEF_ACCOUNTANT,
    RoleType.HEAD_WAREHOUSE,
    RoleType.AUDITOR,
  )
  @ApiOperation({ summary: 'Bitta foydalanuvchi to‘liq tafsilotlari' })
  async findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Get(':id/assets')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.RECTOR,
    RoleType.VICE_RECTOR_FINANCE,
    RoleType.CHIEF_ACCOUNTANT,
    RoleType.HEAD_WAREHOUSE,
    RoleType.AUDITOR,
    RoleType.MOL,
    RoleType.EMPLOYEE,
  )
  @ApiOperation({ summary: 'Xodimga biriktirilgan xonalar va ashyolar (MOL pasporti)' })
  async getUserAssets(@Param('id') id: string) {
    return this.usersService.getUserAssets(id);
  }

  @Get(':id/clearance-status')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.RECTOR,
    RoleType.VICE_RECTOR_FINANCE,
    RoleType.CHIEF_ACCOUNTANT,
    RoleType.HEAD_WAREHOUSE,
    RoleType.AUDITOR,
    RoleType.MOL,
  )
  @ApiOperation({ summary: 'Xodimning moddiy javobgarlikdan ozodlik / aylanma varaqa (Clearance) holatini tekshirish' })
  async getClearanceStatus(@Param('id') id: string) {
    return this.usersService.checkUserClearanceEligibility(id);
  }

  @Post()
  @Roles(RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Yangi xodim qo‘shish' })
  async create(@Body() dto: CreateUserDto, @Request() req: any) {
    return this.usersService.create(dto, req.user.id);
  }

  @Put(':id')
  @Roles(RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Xodim ma’lumotlari va rolini tahrirlash' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Request() req: any,
  ) {
    return this.usersService.update(id, dto, req.user.id);
  }

  @Patch(':id/status')
  @Roles(RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Xodim faollik holatini o‘zgartirish (Faol / Nofaol)' })
  async toggleStatus(
    @Param('id') id: string,
    @Body() dto: ToggleStatusDto,
    @Request() req: any,
  ) {
    return this.usersService.toggleStatus(id, dto.isActive, req.user.id);
  }

  @Post(':id/reset-password')
  @Roles(RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Administrator tomonidan xodim parolini yangilash' })
  async resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @Request() req: any,
  ) {
    return this.usersService.resetPassword(id, dto, req.user.id);
  }

  @Delete(':id')
  @Roles(RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Foydalanuvchini xavfsiz o‘chirish (Soft delete)' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.usersService.remove(id, req.user.id);
  }

  @Post(':id/restore')
  @Roles(RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'O‘chirilgan foydalanuvchini qayta tiklash (Restore)' })
  async restore(@Param('id') id: string, @Request() req: any) {
    return this.usersService.restore(id, req.user.id);
  }
}
