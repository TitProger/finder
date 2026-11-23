import { Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { Public } from '../../auth/public.decorator';
import { StoredFileHttpService } from '../../services/impls/file/stored-file.http-service';

@Public()
@Controller('files')
export class StoredFileController {
    constructor(private readonly files: StoredFileHttpService) {}

    @Public()
    @Post()
    upload(@Req() request: FastifyRequest) {
        return this.files.upload(request);
    }

    @Public()
    @Get(':id/content')
    content(@Param('id', ParseUUIDPipe) id: string) {
        return this.files.content(id);
    }
}
