import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';

import { Public } from '../../auth/public.decorator';
import { ResearchIngestGuard } from '../../auth/research-ingest.guard';
import type { ResearchDossier } from '../../generated/requests/research';
import { ResearchIngestHttpService } from '../../services/impls/research/research-ingest.http-service';

@Public()
@Controller('research')
export class ResearchIngestController {
    constructor(private readonly ingestService: ResearchIngestHttpService) {}

    @Post('ingest')
    @HttpCode(200)
    @UseGuards(ResearchIngestGuard)
    ingest(@Body() body: ResearchDossier) {
        return this.ingestService.ingest(body);
    }
}
