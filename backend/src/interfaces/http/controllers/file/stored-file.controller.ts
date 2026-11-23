import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';

import { Public } from '../../auth/public.decorator';
import { StoredFileHttpService } from '../../services/impls/file/stored-file.http-service';

@Public()
@Controller('files')
export class StoredFileController {
    constructor(private readonly files: StoredFileHttpService) {}

    @Public()
    @Get(':id/content')
    content(@Param('id', ParseUUIDPipe) id: string) {
        return this.files.content(id);
    }
}
