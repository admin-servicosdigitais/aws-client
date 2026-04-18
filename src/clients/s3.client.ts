import type { Readable } from "stream";
import type { S3Client as S3SDKClient } from "@aws-sdk/client-s3";
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
import { NotImplementedError } from "../errors/aws-client.error.js";

export class S3ClientImpl implements IS3Client {
  constructor(
    private readonly sdk: S3SDKClient,
    private readonly bucketName: string,
  ) {}

  uploadFile(_key: string, _body: Buffer | Readable, _options?: UploadFileOptions): Promise<void> {
    throw new NotImplementedError("S3ClientImpl.uploadFile");
  }

  getFile(_key: string, _options?: GetFileOptions): Promise<Buffer> {
    throw new NotImplementedError("S3ClientImpl.getFile");
  }

  deleteFile(_key: string, _versionId?: string): Promise<void> {
    throw new NotImplementedError("S3ClientImpl.deleteFile");
  }

  deleteFiles(_keys: string[]): Promise<{ deleted: string[]; failed: string[] }> {
    throw new NotImplementedError("S3ClientImpl.deleteFiles");
  }

  copyFile(_sourceKey: string, _destinationKey: string, _options?: CopyObjectOptions): Promise<void> {
    throw new NotImplementedError("S3ClientImpl.copyFile");
  }

  getFileMetadata(_key: string): Promise<S3ObjectMetadata> {
    throw new NotImplementedError("S3ClientImpl.getFileMetadata");
  }

  fileExists(_key: string): Promise<boolean> {
    throw new NotImplementedError("S3ClientImpl.fileExists");
  }

  listFiles(_options?: ListObjectsOptions): Promise<ListObjectsResult> {
    throw new NotImplementedError("S3ClientImpl.listFiles");
  }

  getPresignedGetUrl(_key: string, _options: PresignedUrlOptions): Promise<string> {
    throw new NotImplementedError("S3ClientImpl.getPresignedGetUrl");
  }

  getPresignedPutUrl(_key: string, _options: PresignedUrlOptions): Promise<string> {
    throw new NotImplementedError("S3ClientImpl.getPresignedPutUrl");
  }

  createMultipartUpload(_key: string, _options?: UploadFileOptions): Promise<string> {
    throw new NotImplementedError("S3ClientImpl.createMultipartUpload");
  }

  uploadPart(_key: string, _uploadId: string, _partNumber: number, _body: Buffer): Promise<string> {
    throw new NotImplementedError("S3ClientImpl.uploadPart");
  }

  completeMultipartUpload(_key: string, _uploadId: string, _parts: MultipartUploadPart[]): Promise<void> {
    throw new NotImplementedError("S3ClientImpl.completeMultipartUpload");
  }

  abortMultipartUpload(_key: string, _uploadId: string): Promise<void> {
    throw new NotImplementedError("S3ClientImpl.abortMultipartUpload");
  }
}
