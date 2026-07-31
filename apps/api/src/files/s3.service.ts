import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const UPLOAD_URL_TTL_SECONDS = 5 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

/**
 * Wrapper fino sobre o storage S3-compatible (MinIO em dev). Bucket é
 * sempre privado; todo acesso passa por URL assinada com expiração curta
 * (ver SECURITY.md §2 — storage). As chaves de objeto são geradas pelo
 * FilesService sempre prefixadas por tenantId — nunca aceitas do cliente.
 */
@Injectable()
export class S3Service implements OnModuleInit {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>("S3_BUCKET");
    this.client = new S3Client({
      region: config.get<string>("S3_REGION") ?? "us-east-1",
      endpoint: config.getOrThrow<string>("S3_ENDPOINT"),
      forcePathStyle: config.get<string>("S3_FORCE_PATH_STYLE") === "true",
      credentials: {
        accessKeyId: config.getOrThrow<string>("S3_ACCESS_KEY_ID"),
        secretAccessKey: config.getOrThrow<string>("S3_SECRET_ACCESS_KEY"),
      },
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  createUploadUrl(key: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType });
    return getSignedUrl(this.client, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
  }

  createDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: DOWNLOAD_URL_TTL_SECONDS });
  }
}
