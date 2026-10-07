import manifest from './manifest.json';
import type { Migration } from './types';

export const migrations = manifest satisfies Migration[];
