import { Injectable } from "@nestjs/common";
import { HeadObjectCommand, ObjectCannedACL, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ConfigService } from "@nestjs/config";
import { Readable } from "stream";
import { createReadStream } from "fs";

@Injectable()
export class FileService {
    private s3Client: S3Client;
    private bucketName: string;

    constructor(private configService: ConfigService) {
        const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
        const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
        const accountId = this.configService.get<string>('AWS_R2_ACCOUNT_ID');

        if (!accessKeyId || !secretAccessKey || !accountId) {
            throw new Error('AWS credentials or account ID are missing');
        }

        this.s3Client = new S3Client({
            region: 'auto',
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: {
              accessKeyId,
              secretAccessKey,
            },
        });

        const bucketName = this.configService.get<string>('AWS_R2_BUCKET_NAME');
        if (!bucketName) {
            throw new Error('AWS_R2_BUCKET_NAME is missing');
        }
        this.bucketName = bucketName;
    }

    async uploadFile(
        file: any | { buffer: Buffer; originalname: string; mimetype: string } | { stream: Readable; originalname: string; mimetype: string } | { path: string; originalname: string; mimetype: string },
        folder: string = 'uploads',
        isPublic: boolean = true,
        isUnique: boolean = false
    ): Promise<string> {
        if(isUnique){
            let exists = false;
            try{
              await this.s3Client.send(new HeadObjectCommand({ Bucket: this.bucketName, Key: folder  }))
              exists = true;
            }catch(err){
              console.error(err)
            }
      
            if(exists){
              return `El archivo ya existe`
            }
          }
          try{
            const key =  isUnique ? folder : `${folder}/${Date.now()}-${file.originalname}`;
            
            let body: Buffer | Readable;
            // Si el archivo tiene path (diskStorage), leer desde disco
            if ('path' in file && file.path) {
              body = createReadStream(file.path);
            } else if ('stream' in file) {
              body = file.stream;
            } else if ('buffer' in file && file.buffer) {
              body = file.buffer;
            } else {
              throw new Error('No se pudo obtener el contenido del archivo');
            }
            
            const command = new PutObjectCommand({
              Bucket: this.bucketName,
              Key: key,
              Body: body,
              ContentType: file.mimetype,
              ACL: isPublic ? ObjectCannedACL.public_read : ObjectCannedACL.private
            });
        
            try {
              await this.s3Client.send(command);
              if (isPublic) {
                // return `https://cdn.grupoaleurca.cl/${key}`;
                return `https://melli.fydeli.com/${key}`;
      
              } else {
                // Para archivos privados, retornamos solo la key
                return key;
              }
            } catch (error) {
              throw new Error(`Error al subir archivo a S3: ${error.message}`);
            }
      
          }catch (error) {
            console.error('Error uploading file to S3:', error);
            throw new Error(`Error uploading file: ${error.message}`);
          }
    }
}