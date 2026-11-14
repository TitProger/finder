import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCb);

const KEYLEN = 64;

/**
 * Хэш пароля: scrypt + salt. Формат `scrypt$<saltHex>$<hashHex>`.
 */
export class PasswordHasher {
    static async hash(plain: string): Promise<string> {
        const salt = randomBytes(16).toString('hex');
        const derived = (await scrypt(plain, salt, KEYLEN)) as Buffer;
        return `scrypt$${salt}$${derived.toString('hex')}`;
    }

    static async verify(plain: string, stored: string): Promise<boolean> {
        const [algo, salt, hashHex] = stored.split('$');
        if (algo !== 'scrypt' || !salt || !hashHex) {
            return false;
        }
        const derived = (await scrypt(plain, salt, KEYLEN)) as Buffer;
        const expected = Buffer.from(hashHex, 'hex');
        if (derived.length !== expected.length) {
            return false;
        }
        return timingSafeEqual(derived, expected);
    }
}
