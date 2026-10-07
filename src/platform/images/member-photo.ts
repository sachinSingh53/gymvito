import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'react-native';

import {
  MEMBER_PHOTO_MAX_BYTES,
  type MemberPhotoInput,
} from '@/data/repositories/phase2-repository';

function imageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) =>
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject),
  );
}

export async function pickMemberPhoto(): Promise<MemberPhotoInput | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'image/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const source = new File(result.assets[0].uri);
  let processed: File | null = null;
  try {
    const dimensions = await imageSize(source.uri);
    const side = Math.min(dimensions.width, dimensions.height);
    const image = await manipulateAsync(
      source.uri,
      [
        {
          crop: {
            originX: Math.max(0, Math.round((dimensions.width - side) / 2)),
            originY: Math.max(0, Math.round((dimensions.height - side) / 2)),
            width: side,
            height: side,
          },
        },
        { resize: { width: 256, height: 256 } },
      ],
      { compress: 0.72, format: SaveFormat.JPEG },
    );
    processed = new File(image.uri);
    const bytes = await processed.bytes();
    if (bytes.byteLength > MEMBER_PHOTO_MAX_BYTES) throw new Error('MEMBER_PHOTO_TOO_LARGE');
    return { bytes, mimeType: 'image/jpeg', width: image.width, height: image.height };
  } finally {
    if (processed?.exists) processed.delete();
    if (source.exists) source.delete();
  }
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const combined = (first << 16) | (second << 8) | third;
    result += BASE64_ALPHABET[(combined >> 18) & 63];
    result += BASE64_ALPHABET[(combined >> 12) & 63];
    result += index + 1 < bytes.length ? BASE64_ALPHABET[(combined >> 6) & 63] : '=';
    result += index + 2 < bytes.length ? BASE64_ALPHABET[combined & 63] : '=';
  }
  return result;
}

export function memberPhotoDataUri(photo: MemberPhotoInput): string {
  return `data:${photo.mimeType};base64,${bytesToBase64(photo.bytes)}`;
}
