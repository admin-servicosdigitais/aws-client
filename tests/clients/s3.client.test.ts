import { Readable } from "node:stream";
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
  type S3Client,
} from "@aws-sdk/client-s3";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { S3ClientImpl } from "../../src/clients/s3.client.js";
import { AwsClientError } from "../../src/errors/aws-client.error.js";

const { getSignedUrlMock } = vi.hoisted(() => ({ getSignedUrlMock: vi.fn() }));
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: getSignedUrlMock,
}));

function createSdkMock() {
  const send = vi.fn();
  const sdk = { send } as unknown as S3Client;
  return { sdk, send };
}

describe("S3ClientImpl", () => {
  const bucket = "bucket-demo";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploadFile with success", async () => {
    const { sdk, send } = createSdkMock();
    send.mockResolvedValue({});
    const client = new S3ClientImpl(sdk, bucket);

    await client.uploadFile("path/file.txt", Buffer.from("hello"), {
      contentType: "text/plain",
      metadata: { origin: "test" },
      acl: "private",
      storageClass: "STANDARD",
      tags: { env: "test", app: "aws-client" },
    });

    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0]?.[0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: bucket,
      Key: "path/file.txt",
      ContentType: "text/plain",
      Metadata: { origin: "test" },
      ACL: "private",
      StorageClass: "STANDARD",
      Tagging: "env=test&app=aws-client",
    });
  });

  it("getFile with success", async () => {
    const { sdk, send } = createSdkMock();
    send.mockResolvedValue({
      Body: Readable.from([Buffer.from("conteudo")]),
    });
    const client = new S3ClientImpl(sdk, bucket);

    const output = await client.getFile("path/file.txt", { versionId: "v1", range: "bytes=0-3" });

    expect(output.toString("utf8")).toBe("conteudo");
    const command = send.mock.calls[0]?.[0] as GetObjectCommand;
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command.input).toEqual({
      Bucket: bucket,
      Key: "path/file.txt",
      VersionId: "v1",
      Range: "bytes=0-3",
    });
  });

  it("deleteFile with success", async () => {
    const { sdk, send } = createSdkMock();
    send.mockResolvedValue({});
    const client = new S3ClientImpl(sdk, bucket);

    await client.deleteFile("file.txt", "v2");

    const command = send.mock.calls[0]?.[0] as DeleteObjectCommand;
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input).toEqual({ Bucket: bucket, Key: "file.txt", VersionId: "v2" });
  });

  it("deleteFiles with batch success and failures", async () => {
    const { sdk, send } = createSdkMock();
    send.mockResolvedValue({
      Deleted: [{ Key: "a.txt" }, { Key: "b.txt" }],
      Errors: [{ Key: "c.txt", Code: "AccessDenied" }],
    });
    const client = new S3ClientImpl(sdk, bucket);

    const output = await client.deleteFiles(["a.txt", "b.txt", "c.txt"]);

    expect(output).toEqual({ deleted: ["a.txt", "b.txt"], failed: ["c.txt"] });
    const command = send.mock.calls[0]?.[0] as DeleteObjectsCommand;
    expect(command).toBeInstanceOf(DeleteObjectsCommand);
    expect(command.input.Bucket).toBe(bucket);
    expect(command.input.Delete?.Objects).toEqual([{ Key: "a.txt" }, { Key: "b.txt" }, { Key: "c.txt" }]);
  });

  it("deleteFiles with empty batch does not call SDK", async () => {
    const { sdk, send } = createSdkMock();
    const client = new S3ClientImpl(sdk, bucket);

    const output = await client.deleteFiles([]);

    expect(output).toEqual({ deleted: [], failed: [] });
    expect(send).not.toHaveBeenCalled();
  });

  it("copyFile with success", async () => {
    const { sdk, send } = createSdkMock();
    send.mockResolvedValue({});
    const client = new S3ClientImpl(sdk, bucket);

    await client.copyFile("src.txt", "dst.txt", {
      metadata: { author: "erick" },
      acl: "private",
      storageClass: "STANDARD",
    });

    const command = send.mock.calls[0]?.[0] as CopyObjectCommand;
    expect(command).toBeInstanceOf(CopyObjectCommand);
    expect(command.input).toEqual({
      Bucket: bucket,
      Key: "dst.txt",
      CopySource: `${bucket}/src.txt`,
      MetadataDirective: "REPLACE",
      Metadata: { author: "erick" },
      ACL: "private",
      StorageClass: "STANDARD",
    });
  });

  it("getFileMetadata maps headObject output", async () => {
    const { sdk, send } = createSdkMock();
    const lastModified = new Date("2026-01-01T00:00:00Z");
    send.mockResolvedValue({
      ContentType: "application/json",
      ContentLength: 128,
      LastModified: lastModified,
      ETag: '"etag-1"',
      Metadata: { source: "import" },
      VersionId: "v3",
    });
    const client = new S3ClientImpl(sdk, bucket);

    const output = await client.getFileMetadata("meta.json");

    expect(output).toEqual({
      contentType: "application/json",
      contentLength: 128,
      lastModified,
      etag: '"etag-1"',
      metadata: { source: "import" },
      versionId: "v3",
    });
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(HeadObjectCommand);
  });

  it("fileExists true/false", async () => {
    const { sdk, send } = createSdkMock();
    send.mockResolvedValueOnce({});
    send.mockRejectedValueOnce(Object.assign(new Error("missing"), { name: "NotFound" }));
    const client = new S3ClientImpl(sdk, bucket);

    await expect(client.fileExists("yes.txt")).resolves.toBe(true);
    await expect(client.fileExists("no.txt")).resolves.toBe(false);
  });

  it("listFiles maps prefix and pagination", async () => {
    const { sdk, send } = createSdkMock();
    send.mockResolvedValue({
      Contents: [{ Key: "docs/a.txt", Size: 10, LastModified: new Date("2026-01-02T00:00:00Z"), ETag: '"e1"' }],
      CommonPrefixes: [{ Prefix: "docs/2026/" }],
      IsTruncated: true,
      NextContinuationToken: "token-2",
    });
    const client = new S3ClientImpl(sdk, bucket);

    const output = await client.listFiles({ prefix: "docs/", limit: 1, continuationToken: "token-1" });

    expect(output).toEqual({
      objects: [
        {
          key: "docs/a.txt",
          size: 10,
          lastModified: new Date("2026-01-02T00:00:00Z"),
          etag: '"e1"',
        },
      ],
      commonPrefixes: ["docs/2026/"],
      isTruncated: true,
      nextContinuationToken: "token-2",
    });

    const command = send.mock.calls[0]?.[0] as ListObjectsV2Command;
    expect(command.input).toEqual({
      Bucket: bucket,
      Prefix: "docs/",
      Delimiter: undefined,
      MaxKeys: 1,
      ContinuationToken: "token-1",
    });
  });

  it("getPresignedGetUrl", async () => {
    const { sdk } = createSdkMock();
    getSignedUrlMock.mockResolvedValue("https://signed-get");
    const client = new S3ClientImpl(sdk, bucket);

    const url = await client.getPresignedGetUrl("a.txt", { expiresIn: 60 });

    expect(url).toBe("https://signed-get");
    expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
    expect(getSignedUrlMock.mock.calls[0]?.[0]).toBe(sdk);
    expect(getSignedUrlMock.mock.calls[0]?.[2]).toEqual({ expiresIn: 60 });
  });

  it("getPresignedPutUrl", async () => {
    const { sdk } = createSdkMock();
    getSignedUrlMock.mockResolvedValue("https://signed-put");
    const client = new S3ClientImpl(sdk, bucket);

    const url = await client.getPresignedPutUrl("upload.txt", {
      expiresIn: 120,
      contentType: "text/plain",
    });

    expect(url).toBe("https://signed-put");
    expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
    expect(getSignedUrlMock.mock.calls[0]?.[2]).toEqual({ expiresIn: 120 });
    const command = getSignedUrlMock.mock.calls[0]?.[1] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toEqual({
      Bucket: bucket,
      Key: "upload.txt",
      ContentType: "text/plain",
    });
  });

  it("multipart flow complete", async () => {
    const { sdk, send } = createSdkMock();
    send
      .mockResolvedValueOnce({ UploadId: "upload-1" })
      .mockResolvedValueOnce({ ETag: '"etag-1"' })
      .mockResolvedValueOnce({});
    const client = new S3ClientImpl(sdk, bucket);

    const uploadId = await client.createMultipartUpload("big.bin", {
      contentType: "application/octet-stream",
      tags: { p: "1" },
    });
    const etag = await client.uploadPart("big.bin", uploadId, 1, Buffer.from("part"));
    await client.completeMultipartUpload("big.bin", uploadId, [{ partNumber: 1, etag }]);

    expect(uploadId).toBe("upload-1");
    expect(etag).toBe('"etag-1"');
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(CreateMultipartUploadCommand);
    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(UploadPartCommand);
    const complete = send.mock.calls[2]?.[0] as CompleteMultipartUploadCommand;
    expect(complete).toBeInstanceOf(CompleteMultipartUploadCommand);
    expect(complete.input.MultipartUpload?.Parts).toEqual([{ PartNumber: 1, ETag: '"etag-1"' }]);
  });

  it("abort multipart", async () => {
    const { sdk, send } = createSdkMock();
    send.mockResolvedValue({});
    const client = new S3ClientImpl(sdk, bucket);

    await client.abortMultipartUpload("big.bin", "upload-1");

    const command = send.mock.calls[0]?.[0] as AbortMultipartUploadCommand;
    expect(command).toBeInstanceOf(AbortMultipartUploadCommand);
    expect(command.input).toEqual({
      Bucket: bucket,
      Key: "big.bin",
      UploadId: "upload-1",
    });
  });

  it("error mapping and not found handling", async () => {
    const { sdk, send } = createSdkMock();
    send.mockRejectedValueOnce(new Error("s3 denied"));
    send.mockRejectedValueOnce(Object.assign(new Error("not found"), { $metadata: { httpStatusCode: 404 } }));
    const client = new S3ClientImpl(sdk, bucket);

    await expect(client.getFile("x.txt")).rejects.toMatchObject({
      name: "AwsClientError",
      message: "S3ClientImpl.getFile failed: s3 denied",
    });

    await expect(client.fileExists("missing.txt")).resolves.toBe(false);
  });

  it("throws AwsClientError when multipart responses are incomplete", async () => {
    const { sdk, send } = createSdkMock();
    send.mockResolvedValueOnce({}).mockResolvedValueOnce({});
    const client = new S3ClientImpl(sdk, bucket);

    await expect(client.createMultipartUpload("big.bin")).rejects.toBeInstanceOf(AwsClientError);
    await expect(client.uploadPart("big.bin", "upload", 1, Buffer.from("x"))).rejects.toBeInstanceOf(AwsClientError);
  });
});
