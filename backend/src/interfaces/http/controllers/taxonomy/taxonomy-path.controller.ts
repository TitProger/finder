import { Controller, Get, Query } from '@nestjs/common';

import { Public } from '../../auth/public.decorator';
import { TaxonomyHttpService } from '../../services/impls/taxonomy/taxonomy.http-service';

/**
 * Публичные подсказки пути. Клиент не видит все 2401 узла сразу.
 */
@Public()
@Controller('taxonomy')
export class TaxonomyPathController {
    constructor(private readonly taxonomy: TaxonomyHttpService) {}

    @Public()
    @Get('paths')
    searchPaths(
        @Query('q') q: string,
        @Query('limit') limit?: string,
        @Query('parentId') parentId?: string,
    ) {
        return this.taxonomy.searchPaths({
            q,
            limit: limit != null && limit !== '' ? Number(limit) : undefined,
            parentId: parentId != null && parentId !== '' ? Number(parentId) : undefined,
        });
    }
}
