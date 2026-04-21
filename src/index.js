import "dotenv/config";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { verifyToken } from "./auth.js";
import { tools } from "./tools/index.js";
import { z } from "zod";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const BASE_URL = process.env.DISCOURSE_URL || "https://bothafen.techlogia.de";

// OAuth Discovery Endpoints — Claude Code 2.1+ braucht diese bevor es MCP-Requests sendet.
// Wir antworten mit minimalem Metadata das Bearer-Token-Auth signalisiert.
app.get("/.well-known/oauth-protected-resource", (_req, res) => {
  res.json({
    resource: BASE_URL,
    authorization_servers: [`${BASE_URL}/bothafen/oauth`],
    bearer_methods_supported: ["header"],
    resource_documentation: `${BASE_URL}/bothafen`,
  });
});

app.get("/.well-known/oauth-authorization-server", (_req, res) => {
  res.json({
    issuer: `${BASE_URL}/bothafen/oauth`,
    token_endpoint: `${BASE_URL}/bothafen/oauth/token`,
    grant_types_supported: ["urn:ietf:params:oauth:grant-type:pre-authorized_code"],
    token_endpoint_auth_methods_supported: ["none"],
  });
});

// Wird von Claude Code nach OAuth-Discovery aufgerufen — wir akzeptieren alle Tokens
app.post("/bothafen/oauth/token", (req, res) => {
  res.json({
    access_token: req.body?.pre_authorized_code || "use-your-api-key",
    token_type: "Bearer",
    expires_in: 86400,
  });
});

// MCP Endpoint
app.post("/mcp", async (req, res) => {
  const rawToken = req.headers.authorization?.split(" ")[1];
  const agent = await verifyToken(rawToken);

  if (!agent) {
    return res.status(401)
      .set("WWW-Authenticate", 'Bearer realm="Bothafen", resource_metadata="/.well-known/oauth-protected-resource"')
      .json({ error: "Ungültiger API-Key" });
  }

  const server = new McpServer({ name: "Bothafen", version: "0.1.0" });

  for (const tool of tools) {
    server.tool(
      tool.name,
      tool.description,
      tool.inputSchema.properties
        ? Object.fromEntries(
            Object.entries(tool.inputSchema.properties).map(([k, v]) => [
              k,
              v.type === "integer" ? z.number().int().optional() :
              v.type === "boolean" ? z.boolean().optional() :
              z.string().optional(),
            ])
          )
        : {},
      async (args) => {
        try {
          const result = await tool.handler(args, agent);
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          return { content: [{ type: "text", text: `Fehler: ${err.message}` }], isError: true };
        }
      }
    );
  }

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, () => {
  console.log(`Bothafen MCP-Server läuft auf Port ${PORT}`);
  console.log(`Forum: ${process.env.DISCOURSE_URL}`);
});
