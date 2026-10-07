import { bytesToBase64, memberPhotoDataUri } from './member-photo';

describe('member photo encoding', () => {
  it('encodes database BLOB bytes without creating plaintext files', () => {
    expect(bytesToBase64(Uint8Array.from([77, 97, 110]))).toBe('TWFu');
    expect(bytesToBase64(Uint8Array.from([77, 97]))).toBe('TWE=');
    expect(
      memberPhotoDataUri({
        bytes: Uint8Array.from([255, 216, 255]),
        mimeType: 'image/jpeg',
        width: 1,
        height: 1,
      }),
    ).toBe('data:image/jpeg;base64,/9j/');
  });
});
