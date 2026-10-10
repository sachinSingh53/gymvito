import { DatabaseSync } from 'node:sqlite';

import migrations from './migrations/manifest.json';

describe('supported schema migration matrix', () => {
  test.each(migrations.map((migration) => migration.id))(
    'upgrades schema %i to the current schema',
    (startingSchema) => {
      const database = new DatabaseSync(':memory:');
      for (const migration of migrations.slice(0, startingSchema)) database.exec(migration.sql);
      database.exec(`PRAGMA user_version = ${startingSchema}`);

      for (const migration of migrations.slice(startingSchema)) {
        database.exec(migration.sql);
        database.exec(`PRAGMA user_version = ${migration.id}`);
      }

      expect(database.prepare('PRAGMA user_version').get()).toMatchObject({ user_version: 6 });
      expect(database.prepare('PRAGMA quick_check').get()).toMatchObject({ quick_check: 'ok' });
      expect(
        database
          .prepare(
            "SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('member', 'membership', 'invoice', 'payment', 'backup_record')",
          )
          .get(),
      ).toMatchObject({ count: 5 });
      database.close();
    },
  );
});
