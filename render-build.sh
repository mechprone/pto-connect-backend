#!/usr/bin/env bash
echo "🧹 Cleaning node_modules and reinstalling dependencies with pnpm..."

rm -rf node_modules
rm -rf .pnpm-store
rm -rf ~/.pnpm-store

# Keep the lockfile to ensure reproducible builds
pnpm install --no-frozen-lockfile

echo "✅ Build complete"
