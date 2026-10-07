import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';

export async function pickGymVitoBackup(): Promise<File | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/octet-stream', 'application/vnd.gymvito.backup'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  return new File(result.assets[0].uri);
}

export function createTemporaryProbe(contents: string): File {
  const file = new File(Paths.cache, `gymvito-probe-${Date.now()}.txt`);
  file.create();
  file.write(contents);
  return file;
}

export function deleteTemporaryFile(file: File): void {
  if (file.exists) file.delete();
}
