import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleType } from '@prisma/client';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';

@ApiTags('Organization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/organization')
export class OrganizationController {
  constructor(private readonly orgService: OrganizationService) {}

  // ==================== BUILDINGS ====================

  @Get('buildings')
  @ApiOperation({ summary: 'Barcha universitet binolari va korpuslari ro‘yxati' })
  async getBuildings(@Query('showDeleted') showDeleted?: string) {
    return this.orgService.getBuildings(showDeleted === 'true');
  }

  @Get('buildings/:id')
  @ApiOperation({ summary: 'Bitta bino tafsilotlari, undagi qavatlar va xonalar xaritasi' })
  async getBuildingDetails(@Param('id') id: string) {
    return this.orgService.getBuildingDetails(id);
  }

  @Post('buildings')
  @Roles(RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Yangi bino yoki korpus qo‘shish (Faqat Super Admin)' })
  async createBuilding(@Body() dto: CreateBuildingDto, @Req() req: any) {
    return this.orgService.createBuilding(dto, req.user?.id || req.user?.sub);
  }

  @Put('buildings/:id')
  @Roles(RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Bino ma’lumotlarini tahrirlash (Faqat Super Admin)' })
  async updateBuilding(
    @Param('id') id: string,
    @Body() dto: UpdateBuildingDto,
    @Req() req: any,
  ) {
    return this.orgService.updateBuilding(id, dto, req.user?.id || req.user?.sub);
  }

  @Delete('buildings/:id')
  @Roles(RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Binoni o‘chirish (Faqat Super Admin)' })
  async deleteBuilding(@Param('id') id: string, @Req() req: any) {
    return this.orgService.deleteBuilding(id, req.user?.id || req.user?.sub);
  }

  @Post('buildings/:id/restore')
  @Roles(RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'O‘chirilgan binoni qayta tiklash (Faqat Super Admin)' })
  async restoreBuilding(@Param('id') id: string, @Req() req: any) {
    return this.orgService.restoreBuilding(id, req.user?.id || req.user?.sub);
  }

  // ==================== TREE & DEPARTMENTS ====================

  @Get('tree')
  @ApiOperation({ summary: 'Universitet iyerarxik tuzilmasi (Fakultet -> Kafedra -> Xonalar)' })
  async getTree() {
    return this.orgService.getDepartmentTree();
  }

  @Get('departments')
  @ApiOperation({ summary: 'Barcha bo‘limlar va kafedralar ro‘yxati' })
  async getAllDepartments(@Query('showDeleted') showDeleted?: string) {
    return this.orgService.getAllDepartments(showDeleted === 'true');
  }

  @Post('departments')
  @Roles(RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Yangi fakultet yoki kafedra yaratish (Faqat Super Admin)' })
  async createDepartment(@Body() dto: CreateDepartmentDto, @Req() req: any) {
    return this.orgService.createDepartment(dto, req.user?.id || req.user?.sub);
  }

  @Put('departments/:id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.HEAD_WAREHOUSE)
  @ApiOperation({ summary: 'Fakultet yoki kafedra ma’lumotlarini yangilash' })
  async updateDepartment(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @Req() req: any,
  ) {
    return this.orgService.updateDepartment(id, dto, req.user?.id || req.user?.sub);
  }

  @Delete('departments/:id')
  @Roles(RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Bo‘lim yoki kafedrani o‘chirish (Faqat Super Admin)' })
  async deleteDepartment(@Param('id') id: string, @Req() req: any) {
    return this.orgService.deleteDepartment(id, req.user?.id || req.user?.sub);
  }

  @Post('departments/:id/restore')
  @Roles(RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'O‘chirilgan bo‘limni qayta tiklash (Faqat Super Admin)' })
  async restoreDepartment(@Param('id') id: string, @Req() req: any) {
    return this.orgService.restoreDepartment(id, req.user?.id || req.user?.sub);
  }

  @Get('rooms')
  @ApiOperation({ summary: 'Barcha xonalar va ularning mas’ullari ro‘yxati' })
  async getRooms(@Query('showDeleted') showDeleted?: string) {
    return this.orgService.getRooms(showDeleted === 'true');
  }

  @Get('rooms/:id')
  @ApiOperation({ summary: 'Bitta xona tafsilotlari va undagi barcha jihozlar' })
  async getRoomDetails(@Param('id') id: string) {
    return this.orgService.getRoomDetails(id);
  }

  @Post('rooms')
  @Roles(RoleType.SUPER_ADMIN, RoleType.HEAD_WAREHOUSE)
  @ApiOperation({ summary: 'Yangi auditoriya yoki xona qo‘shish' })
  async createRoom(@Body() dto: CreateRoomDto, @Req() req: any) {
    return this.orgService.createRoom(dto, req.user?.id || req.user?.sub);
  }

  @Put('rooms/:id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.HEAD_WAREHOUSE)
  @ApiOperation({ summary: 'Xona ma’lumotlarini yoki mas’ul shaxsini (MOL) yangilash' })
  async updateRoom(
    @Param('id') id: string,
    @Body() dto: UpdateRoomDto,
    @Req() req: any,
  ) {
    return this.orgService.updateRoom(id, dto, req.user?.id || req.user?.sub);
  }

  @Delete('rooms/:id')
  @Roles(RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'Xonani o‘chirish (Faqat Super Admin)' })
  async deleteRoom(@Param('id') id: string, @Req() req: any) {
    return this.orgService.deleteRoom(id, req.user?.id || req.user?.sub);
  }

  @Post('rooms/:id/restore')
  @Roles(RoleType.SUPER_ADMIN)
  @ApiOperation({ summary: 'O‘chirilgan xonani qayta tiklash (Faqat Super Admin)' })
  async restoreRoom(@Param('id') id: string, @Req() req: any) {
    return this.orgService.restoreRoom(id, req.user?.id || req.user?.sub);
  }

  @Get('warehouses')
  @ApiOperation({ summary: 'Barcha omborxonalar ro‘yxati' })
  async getWarehouses() {
    return this.orgService.getWarehouses();
  }

  @Get('users')
  @ApiOperation({ summary: 'Universitet xodimlari va moddiy javobgar shaxslar ro‘yxati' })
  async getUsers() {
    return this.orgService.getUsers();
  }
}
