/**
 * Точка входа для contract-sync:
 *   node scripts/split-generated-types.mjs
 *
 * Логика — в scripts/split-generated-types/.
 */
import { splitGeneratedTypes } from './split-generated-types/index.mjs';

splitGeneratedTypes();
