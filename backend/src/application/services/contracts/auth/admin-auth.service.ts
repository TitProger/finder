export type AdminAuthTokensResult = {
    accessToken: string;
    refreshToken: string;
    tokenType: 'Bearer';
    expiresIn: number;
    admin: {
        id: string;
        login: string;
        role: 'ADMIN';
        displayName: string | null;
    };
};

export interface AdminAuthService {
    login(login: string, password: string): Promise<AdminAuthTokensResult>;
    refresh(refreshToken: string): Promise<AdminAuthTokensResult>;
}

export const ADMIN_AUTH_SERVICE = Symbol('ADMIN_AUTH_SERVICE');
