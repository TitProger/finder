import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';

import type {
    CreateDossierRequest,
    PublishDossierRequest,
    ReviewDossierRequest,
    UpdateDossierRequest,
} from '../../generated/requests/dossiers';
import { DossierHttpService } from '../../services/impls/market/dossier.http-service';

/**
 * Админское утверждённое досье. Полный контур, включая контакты.
 */
@Controller('admin/dossiers')
export class DossierAdminController {
    constructor(private readonly dossiers: DossierHttpService) {}

    @Post()
    create(@Body() body: CreateDossierRequest) {
        return this.dossiers.create(body);
    }

    @Get(':id')
    getById(@Param('id', ParseUUIDPipe) id: string) {
        return this.dossiers.getById(id);
    }

    @Patch(':id')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateDossierRequest) {
        return this.dossiers.update(id, body);
    }

    @Post(':id/reviews')
    review(@Param('id', ParseUUIDPipe) id: string, @Body() body: ReviewDossierRequest) {
        return this.dossiers.review(id, body);
    }

    @Post(':id/publish')
    publish(@Param('id', ParseUUIDPipe) id: string, @Body() body?: PublishDossierRequest) {
        return this.dossiers.publish(id, body ?? null);
    }
}
