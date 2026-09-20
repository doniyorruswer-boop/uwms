import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { InboxService } from './inbox.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InboxResponseDto } from './dto/inbox.dto';

@ApiTags('Inbox')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/inbox')
export class InboxController {
  constructor(private readonly inboxService: InboxService) {}

  @Get()
  @ApiOperation({
    summary: 'Joriy foydalanuvchining rol va huquqlariga mos kutayotgan vazifalar to‘plami (Action Center)',
  })
  @ApiQuery({ name: 'scope', required: false, enum: ['personal', 'all'] })
  @ApiResponse({ status: 200, type: InboxResponseDto })
  async getInbox(
    @CurrentUser() user: any,
    @Query('scope') scope?: string,
  ): Promise<InboxResponseDto> {
    return this.inboxService.getUserInbox(user, scope);
  }
}
