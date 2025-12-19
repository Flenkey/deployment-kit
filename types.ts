
export enum AppType {
  NODE = "node",
  PYTHON = "python",
  STATIC = "static",
  SPA_NODE = "spa_node",
  UNKNOWN = "unknown"
}

export enum StepId {
  CONTEXT = "CONTEXT",
  NAMING = "NAMING",
  DETECTION = "DETECTION",
  RESOLVER = "RESOLVER",
  GENERATION = "GENERATION",
  VALIDATION = "VALIDATION",
  WRITING = "WRITING",
  DOCKER_CHECK = "DOCKER_CHECK",
  DOCKER_BUILD = "DOCKER_BUILD",
  GCLOUD_CHECK = "GCLOUD_CHECK",
  GCLOUD_AUTH = "GCLOUD_AUTH",
  PROJECT_SELECT = "PROJECT_SELECT",
  DISCOVERY = "DISCOVERY",
  DEPLOYMENT = "DEPLOYMENT",
  POST_DEPLOY = "POST_DEPLOY"
}

export type LogEntry = {
  type: 'info' | 'error' | 'success' | 'system' | 'prompt';
  message: string;
  timestamp: string;
};

export interface Step {
  id: StepId;
  label: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'waiting';
}

export interface DeploymentContext {
  directoryHandle?: FileSystemDirectoryHandle;
  sourcePath: string;
  appName: string;
  serviceName: string;
  projectId: string;
  projectHash?: string;
  region: string;
  imageUri?: string;
  runUrl?: string;
  generatedCommand?: string;
}
