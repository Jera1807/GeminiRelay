/**
 * Connector extension point.
 *
 * Future connectors can be added here by implementing the Connector interface
 * and registering them with the ConnectorRegistry.
 *
 * A connector can:
 * - Intercept/augment prompts before they are sent to Gemini
 * - Process tool calls in the Gemini output
 * - Add context (e.g., web search results, file contents) to prompts
 *
 * Example: Create a file at apps/server/src/connectors/my-connector/index.ts
 * that exports a default Connector implementation.
 */

export interface Connector {
  name: string;
  description: string;
  augmentPrompt?(prompt: string): Promise<string>;
  onRunFinished?(runId: string): Promise<void>;
}

const connectors: Connector[] = [];

export function registerConnector(connector: Connector): void {
  connectors.push(connector);
  console.log(`[Connector] Registered: ${connector.name}`);
}

export function getConnectors(): Connector[] {
  return connectors;
}

export async function applyConnectors(prompt: string): Promise<string> {
  let result = prompt;
  for (const connector of connectors) {
    if (connector.augmentPrompt) {
      result = await connector.augmentPrompt(result);
    }
  }
  return result;
}
