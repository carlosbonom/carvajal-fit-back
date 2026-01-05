import { Injectable } from "@nestjs/common";
import { HeadObjectCommand, ObjectCannedACL, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ConfigService } from "@nestjs/config";
import { createReadStream, createWriteStream, unlinkSync, statSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { Readable } from "stream";
import axios from "axios";
import * as tus from "tus-js-client";

@Injectable()
export class FileService {
  private s3Client: S3Client;
  private bucketName: string;
  private cfApiToken: string;
  private cfAccountId: string;

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

    this.cfApiToken = this.configService.get<string>('CLOUDFLARE_API_TOKEN') || '';
    this.cfAccountId = accountId;

    const bucketName = this.configService.get<string>('AWS_R2_BUCKET_NAME');
    if (!bucketName) {
      throw new Error('AWS_R2_BUCKET_NAME is missing');
    }
    this.bucketName = bucketName;
  }

  private async processVideo(filePath: string, originalName: string): Promise<{ path: string; originalname: string; mimetype: string }> {
    console.log(`Processing video: ${originalName}`);

    // 1. Upload to Cloudflare Stream
    const videoId = await this.uploadToStream(filePath);
    console.log(`Video uploaded to Stream, ID: ${videoId}`);

    // 2. Wait for conversion
    await this.waitForStreamReady(videoId);
    console.log(`Video ready in Stream`);

    // 3. Download converted MP4
    const convertedPath = await this.downloadFromStream(videoId, originalName);
    console.log(`Video downloaded from Stream: ${convertedPath}`);

    // 4. Delete from Stream
    await this.deleteFromStream(videoId);
    console.log(`Video deleted from Stream`);

    return {
      path: convertedPath,
      originalname: originalName.replace(/\.[^/.]+$/, "") + ".mp4",
      mimetype: 'video/mp4'
    };
  }

  private async uploadToStream(filePath: string): Promise<string> {
    const stats = statSync(filePath);
    const stream = createReadStream(filePath);

    return new Promise((resolve, reject) => {
      const upload = new tus.Upload(stream, {
        endpoint: `https://api.cloudflare.com/client/v4/accounts/${this.cfAccountId}/stream`,
        headers: {
          'Authorization': `Bearer ${this.cfApiToken}`,
        },
        chunkSize: 50 * 1024 * 1024, // 50MB
        retryDelays: [0, 3000, 5000, 10000, 20000],
        metadata: {
          filename: filePath.split('/').pop() || 'video.mp4',
          filetype: 'video/mp4',
          downloadable: 'true',
        },
        uploadSize: stats.size,
        onError: (error) => {
          console.error('TUS Upload error:', error);
          reject(error);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
          console.log(`Upload progress: ${percentage}%`);
        },
        onSuccess: () => {
          const urlParts = upload.url?.split('/') || [];
          const uidWithParams = urlParts[urlParts.length - 1];
          const uid = uidWithParams?.split('?')[0];
          if (uid) {
            resolve(uid);
          } else {
            reject(new Error('Could not extract UID from TUS upload URL'));
          }
        },
      });

      upload.start();
    });
  }

  private async waitForStreamReady(videoId: string): Promise<void> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.cfAccountId}/stream/${videoId}`;

    while (true) {
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${this.cfApiToken}`,
        }
      });

      const status = response.data.result.status;
      const pct = status.pctComplete ? parseFloat(status.pctComplete) : 0;

      console.log(`Stream status check: ${status.state} (${pct}%) - Step: ${status.step}`);

      if (status.state === 'ready' && pct >= 100) {
        break;
      } else if (status.state === 'error') {
        throw new Error(`Cloudflare Stream error: ${status.errorReasonText}`);
      }

      // Wait 10 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    // Enable/Trigger download generation
    const downloadUrl = `${url}/downloads`;
    const enableResponse = await axios.post(downloadUrl, {}, {
      headers: {
        'Authorization': `Bearer ${this.cfApiToken}`,
        'Content-Type': 'application/json',
      }
    });
    console.log('Trigger download response:', JSON.stringify(enableResponse.data, null, 2));
  }

  private async downloadFromStream(videoId: string, originalName: string): Promise<string> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.cfAccountId}/stream/${videoId}/downloads`;

    // Polling for download to be available
    let downloadUrl = '';
    const maxRetries = 60; // Wait up to 10 minutes for large files
    for (let i = 0; i < maxRetries; i++) {
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${this.cfApiToken}`,
        }
      });

      console.log(`Download status check (${i + 1}/${maxRetries}) Full Response:`, JSON.stringify(response.data, null, 2));

      if (response.data.result && response.data.result.default && response.data.result.default.url) {
        if (response.data.result.default.percentComplete === 100) {
          downloadUrl = response.data.result.default.url;
          break;
        } else {
          console.log(`Download generating: ${response.data.result.default.percentComplete}%`);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    if (!downloadUrl) {
      throw new Error('Could not get download URL from Cloudflare Stream');
    }

    const tempDir = join(process.cwd(), 'temp-uploads');
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    const tempPath = join(tempDir, `converted-${Date.now()}-${originalName.replace(/\.[^/.]+$/, "")}.mp4`);
    const writer = createWriteStream(tempPath);

    const downloadResponse = await axios.get(downloadUrl, {
      responseType: 'stream'
    });

    downloadResponse.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(tempPath));
      writer.on('error', reject);
    });
  }

  private async deleteFromStream(videoId: string): Promise<void> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.cfAccountId}/stream/${videoId}`;
    await axios.delete(url, {
      headers: {
        'Authorization': `Bearer ${this.cfApiToken}`,
      }
    });
  }

  async uploadFile(
    file: any | { buffer: Buffer; originalname: string; mimetype: string } | { stream: Readable; originalname: string; mimetype: string } | { path: string; originalname: string; mimetype: string },
    folder: string = 'uploads',
    isPublic: boolean = true,
    isUnique: boolean = false
  ): Promise<string> {
    if (isUnique) {
      let exists = false;
      try {
        await this.s3Client.send(new HeadObjectCommand({ Bucket: this.bucketName, Key: folder }))
        exists = true;
      } catch (err) {
        console.error(err)
      }

      if (exists) {
        return `El archivo ya existe`
      }
    }
    try {
      const key = isUnique ? folder : `${folder}/${Date.now()}-${file.originalname}`;

      let body: Buffer | Readable;
      let currentFile = file;

      // Check if conversion is needed
      const isVideo = file.mimetype?.startsWith('video/');
      const isMp4 = file.mimetype === 'video/mp4';
      const stats = ('path' in file && file.path) ? statSync(file.path) : null;
      const sizeInGb = stats ? stats.size / (1024 * 1024 * 1024) : 0;

      if (isVideo && (sizeInGb > 1 || !isMp4) && 'path' in file && file.path) {
        try {
          currentFile = await this.processVideo(file.path, file.originalname);
        } catch (error) {
          console.error('Error processing video with Cloudflare Stream:', error);
          // Continue with original file if processing fails? 
          // No, better to fail if it was requested specifically.
          throw new Error(`Error processing video: ${error.message}`);
        }
      }

      // Si el archivo tiene path (diskStorage), leer desde disco
      if ('path' in currentFile && currentFile.path) {
        body = createReadStream(currentFile.path);
      } else if ('stream' in currentFile) {
        body = currentFile.stream;
      } else if ('buffer' in currentFile && currentFile.buffer) {
        body = currentFile.buffer;
      } else {
        throw new Error('No se pudo obtener el contenido del archivo');
      }

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: currentFile.mimetype,
        ACL: isPublic ? ObjectCannedACL.public_read : ObjectCannedACL.private
      });

      try {
        await this.s3Client.send(command);
        if (isPublic) {
          // Codificar el key para que los espacios y caracteres especiales sean válidos en la URL
          const encodedKey = encodeURI(key);
          return `https://melli.fydeli.com/${encodedKey}`;

        } else {
          // Para archivos privados, retornamos solo la key
          return key;
        }
      } catch (error) {
        throw new Error(`Error al subir archivo a S3: ${error.message}`);
      } finally {
        // Si se creó un archivo convertido temporal, eliminarlo
        if (currentFile !== file && 'path' in currentFile && currentFile.path) {
          try {
            unlinkSync(currentFile.path);
          } catch (err) {
            console.error('Error deleting temporary converted file:', err);
          }
        }
      }

    } catch (error) {
      console.error('Error uploading file to S3:', error);
      throw new Error(`Error uploading file: ${error.message}`);
    }
  }
}