import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AwsCredentials } from "../../src/config/aws.config.js";

const { defaultProviderMock, signerMock, clientCtorMock } = vi.hoisted(() => ({
  defaultProviderMock: vi.fn(),
  signerMock: vi.fn(),
  clientCtorMock: vi.fn(),
}));

vi.mock("@aws-sdk/credential-provider-node", () => ({
  defaultProvider: defaultProviderMock,
}));

vi.mock("@opensearch-project/opensearch/aws-v3", () => ({
  AwsSigv4Signer: signerMock,
}));

vi.mock("@opensearch-project/opensearch", () => ({
  Client: clientCtorMock,
}));

import { OpenSearchServerlessClientImpl } from "../../src/clients/opensearch-serverless.client.js";
import { AwsClientError } from "../../src/errors/aws-client.error.js";

function createOpenSearchMock() {
  return {
    indices: {
      create: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
      putMapping: vi.fn(),
    },
    cat: {
      indices: vi.fn(),
    },
    search: vi.fn(),
    count: vi.fn(),
  };
}

describe("OpenSearchServerlessClientImpl", () => {
  const node = "https://abc123.us-east-1.aoss.amazonaws.com";
  const region = "us-east-1";
  const staticCredentials: AwsCredentials = {
    accessKeyId: "AKIA123",
    secretAccessKey: "SECRET",
    sessionToken: "TOKEN",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    signerMock.mockReturnValue({ connection: { tls: true } });
    defaultProviderMock.mockReturnValue(vi.fn().mockResolvedValue({
      accessKeyId: "DEFAULT",
      secretAccessKey: "DEFAULT_SECRET",
    }));
  });

  it("createIndex mapeia settings e mappings", async () => {
    const openSearchMock = createOpenSearchMock();
    openSearchMock.indices.create.mockResolvedValue({});
    clientCtorMock.mockReturnValue(openSearchMock);

    const client = new OpenSearchServerlessClientImpl(node, region, staticCredentials);

    await client.createIndex("produtos", {
      settings: {
        numberOfShards: 1,
        numberOfReplicas: 2,
        refreshInterval: "1s",
        maxResultWindow: 5000,
        analysis: { analyzer: { meu: {} } },
      },
      mappings: {
        properties: {
          nome: { type: "text", analyzer: "standard" },
          embedding: { type: "dense_vector", dims: 1536, similarity: "cosine" },
          metadata: {
            type: "object",
            properties: {
              categoria: { type: "keyword" },
            },
          },
        },
      },
    });

    expect(openSearchMock.indices.create).toHaveBeenCalledWith({
      index: "produtos",
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 2,
          refresh_interval: "1s",
          max_result_window: 5000,
          analysis: { analyzer: { meu: {} } },
        },
        mappings: {
          properties: {
            nome: { type: "text", analyzer: "standard" },
            embedding: { type: "dense_vector", dims: 1536, similarity: "cosine" },
            metadata: {
              type: "object",
              properties: {
                categoria: { type: "keyword" },
              },
            },
          },
        },
      },
    });
  });

  it("deleteIndex remove índice", async () => {
    const openSearchMock = createOpenSearchMock();
    openSearchMock.indices.delete.mockResolvedValue({});
    clientCtorMock.mockReturnValue(openSearchMock);

    const client = new OpenSearchServerlessClientImpl(node, region, staticCredentials);

    await client.deleteIndex("produtos");

    expect(openSearchMock.indices.delete).toHaveBeenCalledWith({ index: "produtos" });
  });

  it("indexExists retorna true e false", async () => {
    const openSearchMock = createOpenSearchMock();
    openSearchMock.indices.exists
      .mockResolvedValueOnce({ body: true })
      .mockResolvedValueOnce({ body: false });
    clientCtorMock.mockReturnValue(openSearchMock);

    const client = new OpenSearchServerlessClientImpl(node, region, staticCredentials);

    await expect(client.indexExists("produtos")).resolves.toBe(true);
    await expect(client.indexExists("inexistente")).resolves.toBe(false);
  });

  it("getIndexInfo consulta índice único e lista geral", async () => {
    const openSearchMock = createOpenSearchMock();
    openSearchMock.cat.indices
      .mockResolvedValueOnce({
        body: [{
          health: "green",
          status: "open",
          index: "produtos",
          "docs.count": "10",
          "docs.deleted": "2",
          "store.size": "5mb",
        }],
      })
      .mockResolvedValueOnce({
        body: [
          {
            health: "yellow",
            status: "open",
            index: "produtos",
            "docs.count": "10",
            "docs.deleted": "0",
            "store.size": "5mb",
          },
          {
            health: "red",
            status: "close",
            index: "pedidos",
            "docs.count": "0",
            "docs.deleted": "0",
            "store.size": "0b",
          },
        ],
      });
    clientCtorMock.mockReturnValue(openSearchMock);

    const client = new OpenSearchServerlessClientImpl(node, region, staticCredentials);

    await expect(client.getIndexInfo("produtos")).resolves.toEqual([
      {
        index: "produtos",
        health: "green",
        status: "open",
        docsCount: 10,
        docsDeleted: 2,
        storeSize: "5mb",
      },
    ]);

    await expect(client.getIndexInfo()).resolves.toEqual([
      {
        index: "produtos",
        health: "yellow",
        status: "open",
        docsCount: 10,
        docsDeleted: 0,
        storeSize: "5mb",
      },
      {
        index: "pedidos",
        health: "red",
        status: "close",
        docsCount: 0,
        docsDeleted: 0,
        storeSize: "0b",
      },
    ]);

    expect(openSearchMock.cat.indices).toHaveBeenNthCalledWith(1, { index: "produtos", format: "json" });
    expect(openSearchMock.cat.indices).toHaveBeenNthCalledWith(2, { index: undefined, format: "json" });
  });

  it("putMapping envia mappings convertidos", async () => {
    const openSearchMock = createOpenSearchMock();
    openSearchMock.indices.putMapping.mockResolvedValue({});
    clientCtorMock.mockReturnValue(openSearchMock);

    const client = new OpenSearchServerlessClientImpl(node, region, staticCredentials);

    await client.putMapping("produtos", {
      properties: {
        nome: { type: "text" },
        ativo: { type: "boolean" },
      },
    });

    expect(openSearchMock.indices.putMapping).toHaveBeenCalledWith({
      index: "produtos",
      body: {
        properties: {
          nome: { type: "text" },
          ativo: { type: "boolean" },
        },
      },
    });
  });

  it("search textual retorna resultado tipado", async () => {
    const openSearchMock = createOpenSearchMock();
    openSearchMock.search.mockResolvedValue({
      body: {
        hits: {
          total: { value: 1, relation: "eq" },
          hits: [{
            _id: "doc-1",
            _score: 1.2,
            _source: { nome: "Tênis" },
            highlight: { nome: ["<em>Tênis</em>"] },
          }],
        },
        aggregations: { por_categoria: { buckets: [] } },
        took: 7,
        timed_out: false,
      },
    });
    clientCtorMock.mockReturnValue(openSearchMock);

    const client = new OpenSearchServerlessClientImpl(node, region, staticCredentials);
    const result = await client.search<{ nome: string }>("produtos", {
      query: { match: { nome: "tenis" } },
      sort: [{ nome: { order: "asc" } }],
      size: 10,
    });

    expect(openSearchMock.search).toHaveBeenCalledWith({
      index: "produtos",
      body: {
        query: { match: { nome: "tenis" } },
        sort: [{ nome: { order: "asc" } }],
        size: 10,
      },
    });
    expect(result).toEqual({
      total: { value: 1, relation: "eq" },
      hits: [{
        id: "doc-1",
        score: 1.2,
        source: { nome: "Tênis" },
        highlight: { nome: ["<em>Tênis</em>"] },
      }],
      aggregations: { por_categoria: { buckets: [] } },
      took: 7,
      timedOut: false,
    });
  });

  it("search com knn suporta formato tipado e formato legado do README", async () => {
    const openSearchMock = createOpenSearchMock();
    openSearchMock.search.mockResolvedValue({
      body: {
        hits: { total: 0, hits: [] },
        took: 4,
        timed_out: false,
      },
    });
    clientCtorMock.mockReturnValue(openSearchMock);

    const client = new OpenSearchServerlessClientImpl(node, region, staticCredentials);

    await client.search("produtos", {
      knn: {
        field: "embedding",
        queryVector: [0.1, 0.2],
        k: 5,
      },
    });

    await client.search("produtos", {
      knn: {
        embedding: {
          vector: [0.3, 0.4],
          k: 3,
        },
      } as unknown as { field: string; queryVector: number[]; k: number },
    });

    expect(openSearchMock.search).toHaveBeenNthCalledWith(1, {
      index: "produtos",
      body: {
        knn: {
          embedding: {
            vector: [0.1, 0.2],
            k: 5,
          },
        },
      },
    });

    expect(openSearchMock.search).toHaveBeenNthCalledWith(2, {
      index: "produtos",
      body: {
        knn: {
          embedding: {
            vector: [0.3, 0.4],
            k: 3,
          },
        },
      },
    });
  });

  it("count com e sem query opcional", async () => {
    const openSearchMock = createOpenSearchMock();
    openSearchMock.count
      .mockResolvedValueOnce({ body: { count: 42 } })
      .mockResolvedValueOnce({ body: { count: 100 } });
    clientCtorMock.mockReturnValue(openSearchMock);

    const client = new OpenSearchServerlessClientImpl(node, region, staticCredentials);

    await expect(client.count("produtos", { query: { term: { categoria: "esporte" } } })).resolves.toBe(42);
    await expect(client.count("produtos")).resolves.toBe(100);

    expect(openSearchMock.count).toHaveBeenNthCalledWith(1, {
      index: "produtos",
      body: { query: { term: { categoria: "esporte" } } },
    });
    expect(openSearchMock.count).toHaveBeenNthCalledWith(2, {
      index: "produtos",
    });
  });

  it("usa credenciais explícitas quando fornecidas", async () => {
    const openSearchMock = createOpenSearchMock();
    openSearchMock.indices.exists.mockResolvedValue({ body: true });
    clientCtorMock.mockReturnValue(openSearchMock);

    const client = new OpenSearchServerlessClientImpl(node, region, staticCredentials);

    await client.indexExists("produtos");

    expect(signerMock).toHaveBeenCalledWith(expect.objectContaining({
      region,
      service: "aoss",
      getCredentials: expect.any(Function),
    }));

    const signerOptions = signerMock.mock.calls[0]?.[0] as { getCredentials: () => Promise<AwsCredentials> };
    await expect(signerOptions.getCredentials()).resolves.toEqual(staticCredentials);
    expect(defaultProviderMock).not.toHaveBeenCalled();
  });

  it("usa defaultProvider quando credenciais explícitas não são fornecidas", async () => {
    const openSearchMock = createOpenSearchMock();
    openSearchMock.indices.exists.mockResolvedValue({ body: false });
    clientCtorMock.mockReturnValue(openSearchMock);

    const client = new OpenSearchServerlessClientImpl(node, region);

    await client.indexExists("produtos");

    const signerOptions = signerMock.mock.calls[0]?.[0] as { getCredentials: () => Promise<AwsCredentials> };
    await signerOptions.getCredentials();

    expect(defaultProviderMock).toHaveBeenCalledTimes(1);
  });

  it("mapeia erros para AwsClientError", async () => {
    const openSearchMock = createOpenSearchMock();
    openSearchMock.indices.create.mockRejectedValue(new Error("boom"));
    clientCtorMock.mockReturnValue(openSearchMock);

    const client = new OpenSearchServerlessClientImpl(node, region, staticCredentials);

    await expect(client.createIndex("produtos")).rejects.toMatchObject({
      name: "AwsClientError",
      message: "OpenSearchServerlessClientImpl.createIndex failed: boom",
    });

    await expect(client.createIndex("produtos")).rejects.toBeInstanceOf(AwsClientError);
  });
});
