import { toFileSystemUri } from './file-system-uri';

describe('toFileSystemUri', () => {
  it('converts an absolute native path to a file URI', () => {
    expect(toFileSystemUri('/data/user/0/com.gymvito.app/files/SQLite')).toBe(
      'file:///data/user/0/com.gymvito.app/files/SQLite',
    );
  });

  it('preserves existing file and content URIs', () => {
    expect(toFileSystemUri('file:///data/user/0/gymvito.db')).toBe(
      'file:///data/user/0/gymvito.db',
    );
    expect(toFileSystemUri('content://backup/gymvito.gymvito')).toBe(
      'content://backup/gymvito.gymvito',
    );
  });

  it('preserves relative paths used by non-native test runtimes', () => {
    expect(toFileSystemUri('.')).toBe('.');
  });
});
