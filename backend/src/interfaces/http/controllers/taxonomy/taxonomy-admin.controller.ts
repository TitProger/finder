import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';

import type { UpdateTaxonomyNodeRequest } from '../../generated/requests/taxonomy';
import { TaxonomyHttpService } from '../../services/impls/taxonomy/taxonomy.http-service';

/**
 * Админский поиск и правка узла. Требует AdminTokenGuard.
 */
@Controller('admin/taxonomy/nodes')
export class TaxonomyAdminController {
    constructor(private readonly taxonomy: TaxonomyHttpService) {}

    @Get()
    list(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('q') q?: string,
        @Query('parentId') parentId?: string,
    ) {
        return this.taxonomy.listAdmin({
            page: page != null && page !== '' ? Number(page) : undefined,
            limit: limit != null && limit !== '' ? Number(limit) : undefined,
            q,
            parentId: parentId != null && parentId !== '' ? Number(parentId) : undefined,
        });
    }

    @Patch(':nodeId')
    update(@Param('nodeId', ParseIntPipe) nodeId: number, @Body() body: UpdateTaxonomyNodeRequest) {
        return this.taxonomy.updateNode(nodeId, body);
    }
}
