# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy solution and project files for caching restore layer
COPY FaroRestaurant.sln ./
COPY src/FaroRestaurant.Domain/*.csproj ./src/FaroRestaurant.Domain/
COPY src/FaroRestaurant.Application/*.csproj ./src/FaroRestaurant.Application/
COPY src/FaroRestaurant.Infrastructure/*.csproj ./src/FaroRestaurant.Infrastructure/
COPY src/FaroRestaurant.Api/*.csproj ./src/FaroRestaurant.Api/

RUN dotnet restore

# Copy all source files and publish
COPY . .
RUN dotnet publish src/FaroRestaurant.Api/FaroRestaurant.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "FaroRestaurant.Api.dll"]
