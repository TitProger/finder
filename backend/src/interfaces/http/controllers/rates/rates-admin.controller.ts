import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';

import type {
    CreateLogisticsRateRequest,
    UpdateLogisticsRateRequest,
} from '../../generated/requests/rates';
import { RatesHttpService } from '../../services/impls/rates/rates.http-service';

/**
 * Справочник ставок владельца. Книга может быть пустой.
 */
@Controller('admin/rates')
export class RatesAdminController {
    constructor(private readonly rates: RatesHttpService) {}

    @Get()
    list(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('activeOnly') activeOnly?: string,
    ) {
        return this.rates.list({
            page: page != null && page !== '' ? Number(page) : undefined,
            limit: limit != null && limit !== '' ? Number(limit) : undefined,
            activeOnly: activeOnly === 'true' || activeOnly === '1',
        });
    }

    @Post()
    create(@Body() body: CreateLogisticsRateRequest) {
        return this.rates.create(body);
    }

    @Get(':id')
    getById(@Param('id', ParseUUIDPipe) id: string) {
        return this.rates.getById(id);
    }

    @Patch(':id')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateLogisticsRateRequest) {
        return this.rates.update(id, body);
    }

    @Delete(':id')
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.rates.remove(id);
    }
}
