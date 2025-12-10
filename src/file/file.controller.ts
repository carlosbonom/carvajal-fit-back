import { Body, Controller, Post, UploadedFile, UseInterceptors, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { FileService } from "./file.service";

@Controller('file')
export class FileController {
    constructor(private readonly fileService: FileService) {}

    @Post('upload')
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 1024 }), // 1GB
                    new FileTypeValidator({ 
                        fileType: /^(video|image|application|audio|text)\// 
                    }),
                ],
            }),
        )
        file: Express.Multer.File,
        @Body('folder') folder?: string,
        @Body('isPublic') isPublic?: boolean,
    ){
        const url = await this.fileService.uploadFile(
            file, 
            folder, 
            isPublic ?? true,
        );
        return { url };
    }

}