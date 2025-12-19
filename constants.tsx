
import { AppType, StepId } from './types';

export const DOCKER_TEMPLATES: Record<Exclude<AppType, AppType.UNKNOWN>, string> = {
  [AppType.NODE]: `FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]`,
  
  [AppType.PYTHON]: `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PORT=8080
CMD ["python", "app.py"]`,

  [AppType.STATIC]: `FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80`,

  [AppType.SPA_NODE]: `# Stage 1: Build Phase
FROM node:18-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Executes vite build -> generates dist/
RUN npm run build

# Stage 2: Production Server Phase
FROM node:18-slim
WORKDIR /app

# Install Express to handle production serving and SPA routing fallbacks
RUN npm install express

# Copy built assets from builder stage
COPY --from=builder /app/dist ./dist

# Generate a production-ready entrypoint for Cloud Run
RUN echo "const express = require('express'); \\
const path = require('path'); \\
const app = express(); \\
const port = process.env.PORT || 8080; \\
\\
// Serve static assets from dist/ \\
app.use(express.static(path.join(__dirname, 'dist'))); \\
\\
// SPA Routing: Redirect all non-file requests to index.html \\
app.get('*', (req, res) => { \\
  res.sendFile(path.join(__dirname, 'dist', 'index.html')); \\
}); \\
\\
app.listen(port, () => { \\
  console.log('SPA Runtime active on port', port); \\
});" > server.js

ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]`
};

export const INITIAL_STEPS = [
  { id: StepId.CONTEXT, label: 'Context Resolution', status: 'idle' },
  { id: StepId.NAMING, label: 'Service Naming', status: 'idle' },
  { id: StepId.DETECTION, label: 'Stack Detection', status: 'idle' },
  { id: StepId.GCLOUD_AUTH, label: 'Cloud Auth', status: 'idle' },
  { id: StepId.DISCOVERY, label: 'Cloud Discovery', status: 'idle' },
  { id: StepId.DEPLOYMENT, label: 'Cloud Run Deploy', status: 'idle' },
] as const;

export const CLOUD_RUN_REGIONS = [
  { id: 'us-central1', label: 'Iowa', geo: 'Americas' },
  { id: 'us-east1', label: 'S. Carolina', geo: 'Americas' },
  { id: 'us-east4', label: 'N. Virginia', geo: 'Americas' },
  { id: 'us-west1', label: 'Oregon', geo: 'Americas' },
  { id: 'northamerica-northeast1', label: 'Montreal', geo: 'Americas' },
  { id: 'southamerica-east1', label: 'São Paulo', geo: 'Americas' },
  { id: 'europe-west1', label: 'Belgium', geo: 'Europe' },
  { id: 'europe-west2', label: 'London', geo: 'Europe' },
  { id: 'europe-west3', label: 'Frankfurt', geo: 'Europe' },
  { id: 'europe-west4', label: 'Netherlands', geo: 'Europe' },
  { id: 'europe-north1', label: 'Finland', geo: 'Europe' },
  { id: 'asia-northeast1', label: 'Tokyo', geo: 'Asia Pacific' },
  { id: 'asia-northeast2', label: 'Osaka', geo: 'Asia Pacific' },
  { id: 'asia-east1', label: 'Taiwan', geo: 'Asia Pacific' },
  { id: 'asia-southeast1', label: 'Singapore', geo: 'Asia Pacific' },
  { id: 'australia-southeast1', label: 'Sydney', geo: 'Asia Pacific' },
] as const;
