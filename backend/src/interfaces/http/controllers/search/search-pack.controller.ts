import { Controller, Get } from '@nestjs/common';

import { SearchPackService } from '@/application/services/impls/search/search-pack.service';
import type { SearchPack } from '../../generated/responses/search';
import { Public } from '../../auth/public.decorator';

/** Пачка первой страницы. Токен не нужен. */
@Public()
@Controller('search')
export class SearchPackController {
    constructor(private readonly pack: SearchPackService) {}

    @Get('pack')
    getPack(): SearchPack {
        return this.pack.get();
    }
}
