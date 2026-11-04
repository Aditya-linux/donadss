export type ConnectorId = "google-workspace" | "slack" | "github" | "telegram";

export type ConnectorSummary = {
  id: ConnectorId;
  name: string;
  purpose: string;
  capabilities: string[];
  configured: boolean;
  connection_mode: "oauth" | "bot-link";
  required_environment: string[];
  financial_authority: false;
};

const definitions: Array<Omit<ConnectorSummary, "configured">> = [
  {
    id: "google-workspace", name: "Google Workspace",
    purpose: "Read user-selected receipts and save Mission reports to Drive.",
    capabilities: ["Gmail receipt lookup", "Drive report export"], connection_mode: "oauth",
    required_environment: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "DONADS_CONNECTOR_ENCRYPTION_KEY"],
    financial_authority: false,
  },
  {
    id: "slack", name: "Slack",
    purpose: "Start non-financial Missions and deliver checkpoint notifications.",
    capabilities: ["Mission requests", "Status notifications"], connection_mode: "oauth",
    required_environment: ["SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET", "DONADS_CONNECTOR_ENCRYPTION_KEY"],
    financial_authority: false,
  },
  {
    id: "github", name: "GitHub",
    purpose: "Create and track development tasks with explicit repository scopes.",
    capabilities: ["Issue context", "Review-ready task drafts"], connection_mode: "oauth",
    required_environment: ["GITHUB_OAUTH_CLIENT_ID", "GITHUB_OAUTH_CLIENT_SECRET", "DONADS_CONNECTOR_ENCRYPTION_KEY"],
    financial_authority: false,
  },
  {
    id: "telegram", name: "Telegram",
    purpose: "Receive Mission updates and open approval checkpoints on mobile.",
    capabilities: ["Status notifications", "Approval deep links"], connection_mode: "bot-link",
    required_environment: ["TELEGRAM_BOT_TOKEN", "DONADS_CONNECTOR_ENCRYPTION_KEY"],
    financial_authority: false,
  },
];

export function connectorCatalog(): ConnectorSummary[] {
  return definitions.map((definition) => ({
    ...definition,
    configured: definition.required_environment.every((name) => Boolean(process.env[name]?.trim())),
  }));
}
