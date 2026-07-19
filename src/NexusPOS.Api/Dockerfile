# ── Stage 1: Base runtime ─────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:9.0-alpine AS base
WORKDIR /app
EXPOSE 8080

# Security: run as non-root user
ENV ASPNETCORE_HTTP_PORTS=8080

RUN addgroup -S nexuspos && adduser -S nexuspos -G nexuspos
USER nexuspos

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:9.0-alpine AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src

# Copy solution and project files first for layer caching
COPY ["NexusPOS.sln", "."]
COPY ["Directory.Build.props", "."]
COPY ["Directory.Packages.props", "."]

# API and SharedKernel
COPY ["src/NexusPOS.Api/NexusPOS.Api.csproj", "src/NexusPOS.Api/"]
COPY ["src/NexusPOS.SharedKernel/NexusPOS.SharedKernel.csproj", "src/NexusPOS.SharedKernel/"]

# All module projects
COPY ["src/Modules/IAM/NexusPOS.IAM/NexusPOS.IAM.csproj", "src/Modules/IAM/NexusPOS.IAM/"]
COPY ["src/Modules/Organization/NexusPOS.Organization/NexusPOS.Organization.csproj", "src/Modules/Organization/NexusPOS.Organization/"]
COPY ["src/Modules/Catalog/NexusPOS.Catalog/NexusPOS.Catalog.csproj", "src/Modules/Catalog/NexusPOS.Catalog/"]
COPY ["src/Modules/Inventory/NexusPOS.Inventory/NexusPOS.Inventory.csproj", "src/Modules/Inventory/NexusPOS.Inventory/"]
COPY ["src/Modules/POS/NexusPOS.POS/NexusPOS.POS.csproj", "src/Modules/POS/NexusPOS.POS/"]
COPY ["src/Modules/Sales/NexusPOS.Sales/NexusPOS.Sales.csproj", "src/Modules/Sales/NexusPOS.Sales/"]
COPY ["src/Modules/Purchasing/NexusPOS.Purchasing/NexusPOS.Purchasing.csproj", "src/Modules/Purchasing/NexusPOS.Purchasing/"]
COPY ["src/Modules/CRM/NexusPOS.CRM/NexusPOS.CRM.csproj", "src/Modules/CRM/NexusPOS.CRM/"]
COPY ["src/Modules/Finance/NexusPOS.Finance/NexusPOS.Finance.csproj", "src/Modules/Finance/NexusPOS.Finance/"]
COPY ["src/Modules/Restaurant/NexusPOS.Restaurant/NexusPOS.Restaurant.csproj", "src/Modules/Restaurant/NexusPOS.Restaurant/"]
COPY ["src/Modules/Hotel/NexusPOS.Hotel/NexusPOS.Hotel.csproj", "src/Modules/Hotel/NexusPOS.Hotel/"]
COPY ["src/Modules/Gaming/NexusPOS.Gaming/NexusPOS.Gaming.csproj", "src/Modules/Gaming/NexusPOS.Gaming/"]
COPY ["src/Modules/SuperAdmin/NexusPOS.SuperAdmin/NexusPOS.SuperAdmin.csproj", "src/Modules/SuperAdmin/NexusPOS.SuperAdmin/"]

RUN dotnet restore "src/NexusPOS.Api/NexusPOS.Api.csproj"

# Copy full source
COPY . .

RUN dotnet build "src/NexusPOS.Api/NexusPOS.Api.csproj" \
    -c $BUILD_CONFIGURATION \
    -o /app/build \
    --no-restore

# ── Stage 3: Publish ──────────────────────────────────────────────────────────
FROM build AS publish
ARG BUILD_CONFIGURATION=Release

RUN dotnet publish "src/NexusPOS.Api/NexusPOS.Api.csproj" \
    -c $BUILD_CONFIGURATION \
    -o /app/publish \
    --no-restore \
    --no-build \
    /p:UseAppHost=false

# ── Stage 4: Development (with hot reload) ───────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:9.0-alpine AS development
WORKDIR /app
ENV ASPNETCORE_ENVIRONMENT=Development
ENV DOTNET_WATCH_SUPPRESS_MSBUILD_INCREMENTALISM=true
EXPOSE 8080
ENTRYPOINT ["dotnet", "watch", "--project", "src/NexusPOS.Api", "run", "--urls", "http://+:8080"]

# ── Stage 5: Final production image ──────────────────────────────────────────
FROM base AS production
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "NexusPOS.Api.dll"]
