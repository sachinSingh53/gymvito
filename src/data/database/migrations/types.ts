export type Migration = Readonly<{
  id: number;
  name: string;
  checksum: string;
  sql: string;
}>;
