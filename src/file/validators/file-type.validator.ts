import { FileValidator } from '@nestjs/common';
import { IFile } from '@nestjs/common/pipes/file/interfaces';

export class CustomFileTypeValidator extends FileValidator<{ fileType: RegExp }> {
  buildErrorMessage(file: IFile): string {
    return `Tipo de archivo no permitido. Tipo recibido: ${file.mimetype}`;
  }

  isValid(file: IFile): boolean {
    if (!this.validationOptions?.fileType) {
      return true;
    }
    return this.validationOptions.fileType.test(file.mimetype);
  }
}

