import { Controller, Get } from '@nestjs/common';

import type { HealthData } from '../../generated/responses/health';
import { Public } from '../../auth/public.decorator';

/**
 * Контроллер возвращает только полезную нагрузку (`data`).
 * Глобальный ApiResponseInterceptor оборачивает её в envelope.
 */
@Controller('health')
export class HealthController {
    @Public()
    @Get()
    check(): HealthData {
        return { status: 'ok' };
    }
}
