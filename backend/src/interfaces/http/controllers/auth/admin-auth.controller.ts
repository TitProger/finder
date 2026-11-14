import { Body, Controller, Inject, Post } from '@nestjs/common';

import {
    ADMIN_AUTH_SERVICE,
    AdminAuthService,
} from '../../../../application/services/contracts/auth/admin-auth.service';
import type { AdminAuthTokens } from '../../generated/responses/auth';
import type { AdminLoginRequest, AdminRefreshRequest } from '../../generated/requests/auth';
import { Public } from '../../auth/public.decorator';

@Controller('admin')
export class AdminAuthController {
    constructor(
        @Inject(ADMIN_AUTH_SERVICE)
        private readonly authService: AdminAuthService,
    ) {}

    @Public()
    @Post('login')
    async login(@Body() body: AdminLoginRequest): Promise<AdminAuthTokens> {
        return this.authService.login(body.login, body.password);
    }

    @Public()
    @Post('refresh')
    async refresh(@Body() body: AdminRefreshRequest): Promise<AdminAuthTokens> {
        return this.authService.refresh(body.refreshToken);
    }
}
