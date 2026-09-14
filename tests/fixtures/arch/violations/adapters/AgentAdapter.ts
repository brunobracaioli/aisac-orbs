export interface AgentAdapter {
  readonly connect: () => Promise<void>;
}
