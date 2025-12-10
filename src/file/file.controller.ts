import { Body, Controller, Post, UploadedFile, UseInterceptors, ParseFilePipe, MaxFileSizeValidator } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { join } from "path";
import { existsSync, mkdirSync, unlink } from "fs";
import { FileService } from "./file.service";
import { CustomFileTypeValidator } from "./validators/file-type.validator";

@Controller('file')
export class FileController {
    constructor(private readonly fileService: FileService) {}

    @Post('upload')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: diskStorage({
                destination: (req, file, cb) => {
                    const uploadPath = join(process.cwd(), 'temp-uploads');
                    if (!existsSync(uploadPath)) {
                        mkdirSync(uploadPath, { recursive: true });
                    }
                    cb(null, uploadPath);
                },
                filename: (req, file, cb) => {
                    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                    cb(null, `${uniqueSuffix}-${file.originalname}`);
                },
            }),
            limits: {
                fileSize: 1024 * 1024 * 1024, // 1GB
            },
        })
    )
    async uploadFile(
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 1024 }), // 1GB
                    new CustomFileTypeValidator({ 
                        fileType: /^(video|image|application|audio|text)\// 
                    }),
                ],
            }),
        )
        file: Express.Multer.File,
        @Body('folder') folder?: string,
        @Body('isPublic') isPublic?: boolean,
    ){
        try {
            const url = await this.fileService.uploadFile(
                file, 
                folder, 
                isPublic ?? true,
            );
            return { url };
        } finally {
            // Limpiar archivo temporal después de subirlo
            if (file?.path) {
                unlink(file.path, (err) => {
                    if (err) console.error('Error al eliminar archivo temporal:', err);
                });
            }
        }
    }

}