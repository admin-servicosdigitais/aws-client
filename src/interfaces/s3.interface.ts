import type { Readable } from "stream";
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

export interface IS3Client {
  uploadFile(key: string, body: Buffer | Readable, options?: UploadFileOptions): Promise<void>;
  getFile(key: string, options?: GetFileOptions): Promise<Buffer>;
  deleteFile(key: string, versionId?: string): Promise<void>;
  deleteFiles(keys: string[]): Promise<{ deleted: string[]; failed: string[] }>;
  copyFile(sourceKey: string, destinationKey: string, options?: CopyObjectOptions): Promise<void>;

  getFileMetadata(key: string): Promise<S3ObjectMetadata>;
  fileExists(key: string): Promise<boolean>;
  listFiles(options?: ListObjectsOptions): Promise<ListObjectsResult>;

  getPresignedGetUrl(key: string, options: PresignedUrlOptions): Promise<string>;
  getPresignedPutUrl(key: string, options: PresignedUrlOptions): Promise<string>;

  createMultipartUpload(key: string, options?: UploadFileOptions): Promise<string>;
  uploadPart(key: string, uploadId: string, partNumber: number, body: Buffer): Promise<string>;
  completeMultipartUpload(key: string, uploadId: string, parts: MultipartUploadPart[]): Promise<void>;
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;
}
