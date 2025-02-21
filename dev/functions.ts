import { VisualElement } from "./element";
import type * as interfaces from "./interfaces";

export function structureElement(
  elementType: keyof HTMLElementTagNameMap,
  classList: string[] = [],
  options: object = {}
): interfaces.VisualElement {
    return new VisualElement(elementType, classList, options);
}

function extractFiles(dtObject: DataTransfer): Array<File> {
  const files: Array<File> = [];
  if (dtObject.items) {
    const droppedItems = dtObject.items;
      for (let i = 0; i < droppedItems.length; i++) {
        if (droppedItems[i].kind === 'file') {
          files.push(droppedItems[i].getAsFile() as File);
        }
      }
    } else {
      for (let i = 0; i < dtObject.files.length; i++) {
        files.push(dtObject.files[i]);
      }
    }
  return files;
}

function splitFileName(fullName: string): string[] {
  const pidx = fullName.lastIndexOf('.');
  const name = fullName.substring(0, pidx);
  const extension = fullName.substring(pidx + 1);
  return [name, extension];
}

// async function distributeFile(f: File) {
//   const [_, extension] = splitFileName(f.name);
//   if (extension === 'key') await encryptor.importKey(f);
//   else encryptor.updateFile(f);
// }

// function dropHandler(e: DragEvent): void {
//   if (!e.dataTransfer) return;
//   const droppedFiles: Array<File> = extractFiles(e.dataTransfer);
//   switch (droppedFiles.length) {
//     case 0:
//       return;
//     case 1:
//     case 2:
//       droppedFiles.forEach(async (f) => {
//         await distributeFile(f);
//       });
//       break;
//     default:
//       throw new Error('Too much files')
//   }
// }

// export function sourceFileInput(e: Event): void {
//   if (!e.target) return;
//   const files: FileList | null = (e.target as HTMLInputElement).files;
//   if (!files) {
//     encryptor.updateFile(undefined);
//     return;
//   }
//   encryptor.updateFile(files[0]);
// }

// export async function sourceKeyInput(e: Event): Promise<void> {
//   if (!e.target) return;
//   const files: FileList | null = (e.target as HTMLInputElement).files;
//   if (!files) {
//     encryptor.updateKey(undefined);
//     return;
//   }
//   await encryptor.importKey(files[0]);
// }
