#!/usr/bin/env bash
echo "🧹 Cleaning old cache and doing a clean install..."

rm -rf node_modules
rm -rf .pnpm-store
rm -rf ~/.pnpm-store
rm -f pnpm-lock.yaml

pnpm install --prefer-offline --frozen-lockfile=false

echo "✅ Build complete"
