#!/bin/bash
# Deploy TruckerDashboard to Azure Static Web Apps (Free tier)
# Usage: ./scripts/deploy.sh
set -euo pipefail

STATIC_WEB_APP_NAME="nhutin-trucker-dashboard"
EXPECTED_URL="https://thankful-water-0807a7b00.1.azurestaticapps.net"

echo "=== Building Dashboard ==="
npm run build

echo ""
echo "=== Fetching deployment token ==="
TOKEN=$(az staticwebapp secrets list --name "$STATIC_WEB_APP_NAME" --query "properties.apiKey" -o tsv)
if [ -z "$TOKEN" ]; then
  echo "ERROR: Could not fetch deployment token. Make sure you're logged into Azure (az login)."
  exit 1
fi

echo ""
echo "=== Deploying to Azure Static Web Apps ==="
npx --yes @azure/static-web-apps-cli deploy build \
  --deployment-token "$TOKEN" \
  --env production

echo ""
echo "=== Verifying deployment ==="
sleep 5
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$EXPECTED_URL")
if [[ "$STATUS" == "200" ]]; then
  echo "Live at $EXPECTED_URL"
else
  echo "Got HTTP $STATUS — may need a moment to propagate"
fi
