import {
  AssociateAgentKnowledgeBaseCommand,
  CreateAgentAliasCommand,
  CreateAgentCommand,
  CreateDataSourceCommand,
  CreateKnowledgeBaseCommand,
  DeleteAgentAliasCommand,
  DeleteAgentCommand,
  DeleteDataSourceCommand,
  DeleteKnowledgeBaseCommand,
  GetAgentAliasCommand,
  GetAgentCommand,
  GetDataSourceCommand,
  GetKnowledgeBaseCommand,
  ListAgentKnowledgeBasesCommand,
  PrepareAgentCommand,
  StartIngestionJobCommand,
  UpdateAgentCommand,
} from "@aws-sdk/client-bedrock-agent";
import { InvokeAgentCommand, RetrieveCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { describe, expect, it, vi } from "vitest";
import { BedrockClientImpl } from "../src/clients/bedrock.client.js";
import { AwsClientError } from "../src/errors/aws-client.error.js";

function createClient(sendImpl?: (command: unknown) => Promise<unknown>) {
  const agentSdk = {
    send: vi.fn(sendImpl ?? (() => Promise.resolve({}))),
  };

  const runtimeSdk = {
    send: vi.fn(sendImpl ?? (() => Promise.resolve({}))),
  };

  return {
    client: new BedrockClientImpl(agentSdk as never, runtimeSdk as never),
    agentSdk,
    runtimeSdk,
  };
}

describe("BedrockClientImpl", () => {
  it("create/get/update/delete agent e prepareAgent", async () => {
    const { client, agentSdk } = createClient(async (command) => {
      if (command instanceof CreateAgentCommand) {
        return { agent: { agentId: "a-1", agentName: "name" } };
      }

      if (command instanceof GetAgentCommand) {
        return {
          agent: {
            agentId: "a-1",
            agentName: "name",
            foundationModel: "model",
            agentResourceRoleArn: "arn:role",
            idleSessionTTLInSeconds: 123,
            instruction: "instr",
          },
        };
      }

      if (command instanceof UpdateAgentCommand) {
        return { agent: { agentId: "a-1", agentName: "updated" } };
      }

      return {};
    });

    const created = await client.createAgent({
      agentName: "name",
      foundationModel: "model",
      instruction: "inst",
      agentResourceRoleArn: "arn:role",
    });
    expect(created.agentId).toBe("a-1");

    const fetched = await client.getAgent("a-1");
    expect(fetched.agentId).toBe("a-1");

    const updated = await client.updateAgent("a-1", { description: "new-desc" });
    expect(updated.agentName).toBe("updated");

    const updateCommand = agentSdk.send.mock.calls.find(([cmd]) => cmd instanceof UpdateAgentCommand)?.[0] as UpdateAgentCommand;
    expect(updateCommand.input).toMatchObject({
      agentId: "a-1",
      description: "new-desc",
      agentName: "name",
      foundationModel: "model",
      instruction: "instr",
      idleSessionTTLInSeconds: 123,
      agentResourceRoleArn: "arn:role",
    });

    await client.prepareAgent("a-1");
    expect(agentSdk.send).toHaveBeenCalledWith(expect.any(PrepareAgentCommand));

    await client.deleteAgent("a-1");
    expect(agentSdk.send).toHaveBeenCalledWith(expect.any(DeleteAgentCommand));
  });

  it("create/get/delete alias", async () => {
    const { client, agentSdk } = createClient(async (command) => {
      if (command instanceof CreateAgentAliasCommand) {
        return { agentAlias: { agentAliasId: "alias-1", agentId: "a-1" } };
      }
      if (command instanceof GetAgentAliasCommand) {
        return { agentAlias: { agentAliasId: "alias-1", agentId: "a-1" } };
      }
      return {};
    });

    const alias = await client.createAgentAlias("a-1", {
      aliasName: "prod",
      routingConfiguration: [{ agentVersion: "1" }],
    });
    expect(alias.agentAliasId).toBe("alias-1");

    const createAliasCommand = agentSdk.send.mock.calls.find(([cmd]) => cmd instanceof CreateAgentAliasCommand)?.[0] as CreateAgentAliasCommand;
    expect(createAliasCommand.input).toMatchObject({
      agentId: "a-1",
      agentAliasName: "prod",
      routingConfiguration: [{ agentVersion: "1" }],
    });

    const fetched = await client.getAgentAlias("a-1", "alias-1");
    expect(fetched.agentAliasId).toBe("alias-1");

    await client.deleteAgentAlias("a-1", "alias-1");
    expect(agentSdk.send).toHaveBeenCalledWith(expect.any(DeleteAgentAliasCommand));
  });

  it("create/get/delete knowledge base, associate e list", async () => {
    const { client, agentSdk } = createClient(async (command) => {
      if (command instanceof CreateKnowledgeBaseCommand) {
        return { knowledgeBase: { knowledgeBaseId: "kb-1", name: "kb" } };
      }
      if (command instanceof GetKnowledgeBaseCommand) {
        return { knowledgeBase: { knowledgeBaseId: "kb-1", name: "kb" } };
      }
      if (command instanceof ListAgentKnowledgeBasesCommand) {
        return {
          agentKnowledgeBaseSummaries: [{ knowledgeBaseId: "kb-1", description: "desc" }],
          nextToken: "next-1",
        };
      }
      return {};
    });

    const created = await client.createKnowledgeBase({
      name: "kb",
      roleArn: "arn:kb",
      knowledgeBaseConfiguration: {
        type: "VECTOR",
        vectorKnowledgeBaseConfiguration: { embeddingModelArn: "arn:model" },
      },
      storageConfiguration: {
        type: "OPENSEARCH_SERVERLESS",
        opensearchServerlessConfiguration: {
          collectionArn: "arn:collection",
          vectorIndexName: "idx",
          fieldMapping: {
            vectorField: "vector",
            textField: "text",
            metadataField: "metadata",
          },
        },
      },
    });
    expect(created.knowledgeBaseId).toBe("kb-1");

    const fetched = await client.getKnowledgeBase("kb-1");
    expect(fetched.knowledgeBaseId).toBe("kb-1");

    await client.associateAgentKnowledgeBase("a-1", "DRAFT", "kb-1", "desc");
    const associateCommand = agentSdk.send.mock.calls.find(([cmd]) => cmd instanceof AssociateAgentKnowledgeBaseCommand)?.[0] as AssociateAgentKnowledgeBaseCommand;
    expect(associateCommand.input).toMatchObject({
      agentId: "a-1",
      agentVersion: "DRAFT",
      knowledgeBaseId: "kb-1",
      description: "desc",
      knowledgeBaseState: "ENABLED",
    });

    const listed = await client.listAgentKnowledgeBases("a-1", "DRAFT");
    expect(listed.items).toHaveLength(1);
    expect(listed.nextToken).toBe("next-1");

    await client.deleteKnowledgeBase("kb-1");
    expect(agentSdk.send).toHaveBeenCalledWith(expect.any(DeleteKnowledgeBaseCommand));
  });

  it("create/get/delete data source e startIngestionJob", async () => {
    const { client, agentSdk } = createClient(async (command) => {
      if (command instanceof CreateDataSourceCommand) {
        return { dataSource: { dataSourceId: "ds-1", knowledgeBaseId: "kb-1", name: "ds" } };
      }
      if (command instanceof GetDataSourceCommand) {
        return { dataSource: { dataSourceId: "ds-1", knowledgeBaseId: "kb-1", name: "ds" } };
      }
      if (command instanceof StartIngestionJobCommand) {
        return { ingestionJob: { ingestionJobId: "ing-1" } };
      }

      return {};
    });

    const created = await client.createDataSource("kb-1", {
      name: "ds",
      dataSourceConfiguration: {
        type: "S3",
        s3Configuration: { bucketArn: "arn:s3:::bucket" },
      },
    });
    expect(created.dataSourceId).toBe("ds-1");

    const fetched = await client.getDataSource("kb-1", "ds-1");
    expect(fetched.dataSourceId).toBe("ds-1");

    const ingestionJobId = await client.startIngestionJob("kb-1", "ds-1", { description: "ing" });
    expect(ingestionJobId).toBe("ing-1");

    await client.deleteDataSource("kb-1", "ds-1");
    expect(agentSdk.send).toHaveBeenCalledWith(expect.any(DeleteDataSourceCommand));
  });

  it("invokeAgent agrega múltiplos chunks, mantém session e coleta traces/citações", async () => {
    const citation = {
      retrievedReferences: [
        {
          content: { text: "doc content" },
          location: { s3Location: { uri: "s3://bucket/file.txt" } },
        },
      ],
    };

    const completionEvents = [
      {
        chunk: {
          bytes: new TextEncoder().encode("Olá "),
          attribution: { citations: [citation] },
        },
      },
      {
        trace: { event: "trace-1" },
      },
      {
        chunk: {
          bytes: new TextEncoder().encode("mundo!"),
        },
      },
    ];

    const { client, runtimeSdk } = createClient(async (command) => {
      if (command instanceof InvokeAgentCommand) {
        return {
          sessionId: "sess-aws",
          completion: completionEvents,
        };
      }
      return {};
    });

    const result = await client.invokeAgent("a-1", "alias-1", {
      inputText: "Oi",
      sessionId: "sess-client",
      enableTrace: true,
    });

    expect(runtimeSdk.send).toHaveBeenCalledWith(expect.any(InvokeAgentCommand));
    expect(result).toMatchObject({
      sessionId: "sess-aws",
      completion: "Olá mundo!",
    });
    expect(result.citations).toHaveLength(1);
    expect(result.traces).toHaveLength(1);
  });

  it("retrieve mapeia resultados e nextToken", async () => {
    const { client, runtimeSdk } = createClient(async (command) => {
      if (command instanceof RetrieveCommand) {
        return {
          retrievalResults: [
            {
              content: { text: "resultado" },
              location: { s3Location: { uri: "s3://bucket/doc.txt" } },
              score: 0.91,
              metadata: { source: "manual" },
            },
          ],
          nextToken: "next-2",
        };
      }
      return {};
    });

    const result = await client.retrieve("kb-1", {
      retrievalQuery: { text: "pergunta" },
      retrievalConfiguration: {
        vectorSearchConfiguration: {
          numberOfResults: 5,
          overrideSearchType: "SEMANTIC",
        },
      },
    });

    expect(runtimeSdk.send).toHaveBeenCalledWith(expect.any(RetrieveCommand));
    expect(result.retrievalResults[0]).toMatchObject({
      content: { text: "resultado" },
      location: { s3Location: { uri: "s3://bucket/doc.txt" } },
      score: 0.91,
      metadata: { source: "manual" },
    });
    expect(result.nextToken).toBe("next-2");
  });

  it("mapeia erros críticos para AwsClientError", async () => {
    const rawError = new Error("kaboom");
    const { client } = createClient(async (command) => {
      if (command instanceof StartIngestionJobCommand) {
        return { ingestionJob: {} };
      }

      throw rawError;
    });

    await expect(client.startIngestionJob("kb-1", "ds-1")).rejects.toBeInstanceOf(AwsClientError);
    await expect(client.getKnowledgeBase("kb-1")).rejects.toThrow("BedrockClientImpl.getKnowledgeBase failed: kaboom");
  });
});
