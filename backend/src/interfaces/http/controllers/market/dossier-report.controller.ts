import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';

import { Public } from '../../auth/public.decorator';
import { DossierHttpService } from '../../services/impls/market/dossier.http-service';

/**
 * Публичный безопасный отчёт. Контакты и сырая закупка не отдаются.
 */
@Public()
@Controller('dossiers')
export class DossierReportController {
    constructor(private readonly dossiers: DossierHttpService) {}

    @Public()
    @Get(':id/report')
    getReport(@Param('id', ParseUUIDPipe) id: string) {
        return this.dossiers.getSafeReport(id);
    }
}
