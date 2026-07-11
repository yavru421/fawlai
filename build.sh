#!/bin/bash
# Exit on error
set -e

# Disable ICU dependency for the .NET CLI run inside the build container
export DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1

# Download the .NET SDK installation script
curl -sSL https://dot.net/v1/dotnet-install.sh > dotnet-install.sh
chmod +x dotnet-install.sh

# Install .NET SDK 10.0 locally
./dotnet-install.sh -c 10.0 -InstallDir ./dotnet
chmod -R +x ./dotnet/   # REQUIRED: Cloudflare CI strips execute bits from all binaries

# Clean old output to prevent stale files
rm -rf output

# Publish the application using the local SDK installation without runtime relinking (emcc/wasm-tools)
./dotnet/dotnet publish -c Release -o output -p:UsingBrowserRuntimeWorkload=false
