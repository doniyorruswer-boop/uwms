import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SearchQueryDto, SearchResultItemDto } from './dto/search.dto';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary:
      'Universitet bo‘yicha global qidiruv (Inventar raqami, xona, foydalanuvchi, talabnoma raqami)',
  })
  @ApiResponse({ status: 200, type: [SearchResultItemDto] })
  async search(
    @Query() query: SearchQueryDto,
    @CurrentUser() user: any,
  ): Promise<SearchResultItemDto[]> {
    return this.searchService.search(query, user);
  }
}
