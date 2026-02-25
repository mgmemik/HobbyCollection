# .NET 8 SDK ile build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Solution dosyalarını kopyala (Backend dizininden çalıştırılacak)
COPY ["HobbyCollection.Api/HobbyCollection.Api.csproj", "HobbyCollection.Api/"]
COPY ["HobbyCollection.Infrastructure/HobbyCollection.Infrastructure.csproj", "HobbyCollection.Infrastructure/"]
COPY ["HobbyCollection.Domain/HobbyCollection.Domain.csproj", "HobbyCollection.Domain/"]

# NuGet restore
RUN dotnet restore "HobbyCollection.Api/HobbyCollection.Api.csproj"

# Tüm kaynak dosyalarını kopyala
COPY . .

# Build ve publish
WORKDIR "/src/HobbyCollection.Api"
RUN dotnet build "HobbyCollection.Api.csproj" -c Release -o /app/build
RUN dotnet publish "HobbyCollection.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Google Cloud Vision API için gerekli kütüphaneler
RUN apt-get update && \
    apt-get install -y libgdiplus libc6-dev && \
    rm -rf /var/lib/apt/lists/*

# Published dosyalarını kopyala
COPY --from=build /app/publish .

# Database dizinini oluştur (database Cloud Storage'dan indirilecek)
RUN mkdir -p /app/data

# Port
EXPOSE 8080

# Environment variable
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

# Entry point
ENTRYPOINT ["dotnet", "HobbyCollection.Api.dll"]

