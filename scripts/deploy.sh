#!/bin/bash
# Deploy TruckerDashboard to Azure Static Web Apps (Free tier)
# Usage: AZURE_SWA_TOKEN=xxx ./scripts/deploy.sh

set -euo pipefail

if [ -z "${AZURE_SWA_TOKEN:-}" ]; then
  echo "Error: AZURE_SWA_TOKEN env var is required"
  echo "Get it from: Azure Portal → Static Web App → Manage deployment token"
  exit 1
fi

echo "Building..."
npm run build

echo "Deploying to Azure Static Web Apps..."
npx @azure/static-web-apps-cli deploy build \
  --deployment-token "$AZURE_SWA_TOKEN" \
  --env production

echo "Done!"
