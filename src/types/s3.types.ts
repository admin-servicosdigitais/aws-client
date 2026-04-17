import type { ObjectCannedACL, StorageClass } from "@aws-sdk/client-s3";

export interface UploadFileOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  acl?: ObjectCannedACL;
  storageClass?: StorageClass;
  tags?: Record<string, string>;
}

export interface GetFileOptions {
  versionId?: string;
  range?: string;
}

export interface S3Object {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
  storageClass?: StorageClass;
}

export interface ListObjectsOptions {
  prefix?: string;
  delimiter?: string;
  limit?: number;
  continuationToken?: string;
}

export interface ListObjectsResult {
  objects: S3Object[];
  commonPrefixes: string[];
  isTruncated: boolean;
  nextContinuationToken?: string;
}

export interface PresignedUrlOptions {
  expiresIn: number;
  contentType?: string;
}

export interface MultipartUploadPart {
  partNumber: number;
  etag: string;
}

export interface CopyObjectOptions {
  metadata?: Record<string, string>;
  acl?: ObjectCannedACL;
  storageClass?: StorageClass;
}

export interface S3ObjectMetadata {
  contentType?: string;
  contentLength?: number;
  lastModified?: Date;
  etag?: string;
  metadata?: Record<string, string>;
  versionId?: string;
}
