import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleType } from '@prisma/client';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.SUPER_ADMIN)
@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Foydalanuvchilar va xodimlar ro‘yxatini olish (Qidiruv, filtrlar va paginatsiya)' })
  async findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bitta foydalanuvchi to‘liq tafsilotlari' })
  async findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Get(':id/assets')
  @ApiOperation({ summary: 'Xodimga biriktirilgan xonalar va ashyolar (MOL pasporti)' })
  async getUserAssets(@Param('id') id: string) {
    return this.usersService.getUserAssets(id);
  }

  @Post()
  @ApiOperation({ summary: 'Yangi xodim qo‘shish' })
  async create(@Body() dto: CreateUserDto, @Request() req: any) {
    return this.usersService.create(dto, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Xodim ma’lumotlari va rolini tahrirlash' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Request() req: any,
  ) {
    return this.usersService.update(id, dto, req.user.id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Xodim faollik holatini o‘zgartirish (Faol / Nofaol)' })
  async toggleStatus(
    @Param('id') id: string,
    @Body() dto: ToggleStatusDto,
    @Request() req: any,
  ) {
    return this.usersService.toggleStatus(id, dto.isActive, req.user.id);
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: 'Administrator tomonidan xodim parolini yangilash' })
  async resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @Request() req: any,
  ) {
    return this.usersService.resetPassword(id, dto, req.user.id);
  }
}
