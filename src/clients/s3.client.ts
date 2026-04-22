import type { Readable } from "stream";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  UploadPartCommand,
  type CompletedPart,
  type Delete,
  type S3Client as S3SDKClient,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { IS3Client } from "../interfaces/s3.interface.js";
import type {
  CopyObjectOptions,
  GetFileOptions,
  ListObjectsOptions,
  ListObjectsResult,
  MultipartUploadPart,
  PresignedUrlOptions,
  S3ObjectMetadata,
  UploadFileOptions,
} from "../types/s3.types.js";
import { AwsClientError } from "../errors/aws-client.error.js";
import { toAwsClientError } from "../internal/utils/error.util.js";
import { streamToBuffer } from "../internal/utils/stream.util.js";
import { parseRequiredAwsDate } from "../internal/utils/date.util.js";

export class S3ClientImpl implements IS3Client {
  constructor(
    private readonly sdk: S3SDKClient,
    private readonly bucketName: string,
  ) {}

  uploadFile(key: string, body: Buffer | Readable, options?: UploadFileOptions): Promise<void> {
    return this.executeWithErrorMapping("S3ClientImpl.uploadFile", async () => {
      await this.sdk.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: options?.contentType,
        Metadata: options?.metadata,
        ACL: options?.acl,
        StorageClass: options?.storageClass,
        Tagging: this.serializeTags(options?.tags),
      }));
    });
  }

  getFile(key: string, options?: GetFileOptions): Promise<Buffer> {
    return this.executeWithErrorMapping("S3ClientImpl.getFile", async () => {
      const output = await this.sdk.send(new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        VersionId: options?.versionId,
        Range: options?.range,
      }));

      return streamToBuffer(output.Body);
    });
  }

  deleteFile(key: string, versionId?: string): Promise<void> {
    return this.executeWithErrorMapping("S3ClientImpl.deleteFile", async () => {
      await this.sdk.send(new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        VersionId: versionId,
      }));
    });
  }

  deleteFiles(keys: string[]): Promise<{ deleted: string[]; failed: string[] }> {
    return this.executeWithErrorMapping("S3ClientImpl.deleteFiles", async () => {
      if (keys.length === 0) {
        return { deleted: [], failed: [] };
      }

      const output = await this.sdk.send(new DeleteObjectsCommand({
        Bucket: this.bucketName,
        Delete: this.buildDeletePayload(keys),
      }));

      return {
        deleted: (output.Deleted ?? []).map((item) => item.Key).filter((key): key is string => key !== undefined),
        failed: (output.Errors ?? []).map((item) => item.Key).filter((key): key is string => key !== undefined),
      };
    });
  }

  copyFile(sourceKey: string, destinationKey: string, options?: CopyObjectOptions): Promise<void> {
    return this.executeWithErrorMapping("S3ClientImpl.copyFile", async () => {
      await this.sdk.send(new CopyObjectCommand({
        Bucket: this.bucketName,
        Key: destinationKey,
        CopySource: `${this.bucketName}/${sourceKey}`,
        MetadataDirective: options?.metadata ? "REPLACE" : undefined,
        Metadata: options?.metadata,
        ACL: options?.acl,
        StorageClass: options?.storageClass,
      }));
    });
  }

  getFileMetadata(key: string): Promise<S3ObjectMetadata> {
    return this.executeWithErrorMapping("S3ClientImpl.getFileMetadata", async () => {
      const output = await this.sdk.send(new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }));

      return {
        ...(output.ContentType !== undefined && { contentType: output.ContentType }),
        ...(output.ContentLength !== undefined && { contentLength: output.ContentLength }),
        ...(output.LastModified !== undefined && { lastModified: output.LastModified }),
        ...(output.ETag !== undefined && { etag: output.ETag }),
        ...(output.Metadata !== undefined && { metadata: output.Metadata }),
        ...(output.VersionId !== undefined && { versionId: output.VersionId }),
      };
    });
  }

  fileExists(key: string): Promise<boolean> {
    return this.executeNotFoundAsFalse("S3ClientImpl.fileExists", async () => {
      await this.sdk.send(new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }));
      return true;
    });
  }

  listFiles(options?: ListObjectsOptions): Promise<ListObjectsResult> {
    return this.executeWithErrorMapping("S3ClientImpl.listFiles", async () => {
      const output = await this.sdk.send(new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: options?.prefix,
        Delimiter: options?.delimiter,
        MaxKeys: options?.limit,
        ContinuationToken: options?.continuationToken,
      }));

      return {
        objects: (output.Contents ?? []).map((obj) => ({
          key: obj.Key ?? "",
          size: obj.Size ?? 0,
          lastModified: parseRequiredAwsDate(obj.LastModified, `Contents[${obj.Key ?? "unknown"}].LastModified`),
          etag: obj.ETag ?? "",
          ...(obj.StorageClass !== undefined && { storageClass: obj.StorageClass }),
        })),
        commonPrefixes: (output.CommonPrefixes ?? [])
          .map((prefix) => prefix.Prefix)
          .filter((prefix): prefix is string => prefix !== undefined),
        isTruncated: output.IsTruncated ?? false,
        ...(output.NextContinuationToken !== undefined && {
          nextContinuationToken: output.NextContinuationToken,
        }),
      };
    });
  }

  getPresignedGetUrl(key: string, options: PresignedUrlOptions): Promise<string> {
    return this.executeWithErrorMapping("S3ClientImpl.getPresignedGetUrl", async () => {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      return getSignedUrl(this.sdk, command, { expiresIn: options.expiresIn });
    });
  }

  getPresignedPutUrl(key: string, options: PresignedUrlOptions): Promise<string> {
    return this.executeWithErrorMapping("S3ClientImpl.getPresignedPutUrl", async () => {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: options.contentType,
      });

      return getSignedUrl(this.sdk, command, { expiresIn: options.expiresIn });
    });
  }

  createMultipartUpload(key: string, options?: UploadFileOptions): Promise<string> {
    return this.executeWithErrorMapping("S3ClientImpl.createMultipartUpload", async () => {
      const output = await this.sdk.send(new CreateMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: options?.contentType,
        Metadata: options?.metadata,
        ACL: options?.acl,
        StorageClass: options?.storageClass,
        Tagging: this.serializeTags(options?.tags),
      }));

      if (!output.UploadId) {
        throw new AwsClientError("S3ClientImpl.createMultipartUpload: AWS S3 returned empty uploadId", output);
      }

      return output.UploadId;
    });
  }

  uploadPart(key: string, uploadId: string, partNumber: number, body: Buffer): Promise<string> {
    return this.executeWithErrorMapping("S3ClientImpl.uploadPart", async () => {
      const output = await this.sdk.send(new UploadPartCommand({
        Bucket: this.bucketName,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: body,
      }));

      if (!output.ETag) {
        throw new AwsClientError("S3ClientImpl.uploadPart: AWS S3 returned empty ETag", output);
      }

      return output.ETag;
    });
  }

  completeMultipartUpload(key: string, uploadId: string, parts: MultipartUploadPart[]): Promise<void> {
    return this.executeWithErrorMapping("S3ClientImpl.completeMultipartUpload", async () => {
      const completedParts: CompletedPart[] = parts
        .map((part) => ({ PartNumber: part.partNumber, ETag: part.etag }))
        .sort((a, b) => (a.PartNumber ?? 0) - (b.PartNumber ?? 0));

      await this.sdk.send(new CompleteMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: completedParts },
      }));
    });
  }

  abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    return this.executeWithErrorMapping("S3ClientImpl.abortMultipartUpload", async () => {
      await this.sdk.send(new AbortMultipartUploadCommand({
        Bucket: this.bucketName,
        Key: key,
        UploadId: uploadId,
      }));
    });
  }

  private serializeTags(tags: Record<string, string> | undefined): string | undefined {
    if (!tags || Object.keys(tags).length === 0) {
      return undefined;
    }

    return Object.entries(tags)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&");
  }

  private buildDeletePayload(keys: string[]): Delete {
    return {
      Objects: keys.map((key) => ({ Key: key })),
      Quiet: false,
    };
  }

  private isNotFoundError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const errorWithMetadata = error as Error & { $metadata?: { httpStatusCode?: number } };
    return error.name === "NotFound" || error.name === "NoSuchKey" || errorWithMetadata.$metadata?.httpStatusCode === 404;
  }

  private async executeWithErrorMapping<T>(context: string, executor: () => Promise<T>): Promise<T> {
    try {
      return await executor();
    } catch (error) {
      throw toAwsClientError(error, `${context} failed`);
    }
  }

  private async executeNotFoundAsFalse(context: string, executor: () => Promise<boolean>): Promise<boolean> {
    try {
      return await executor();
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return false;
      }

      throw toAwsClientError(error, `${context} failed`);
    }
  }
}
