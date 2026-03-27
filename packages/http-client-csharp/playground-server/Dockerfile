FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY playground-server.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app .

# The generator DLL must be provided at runtime via GENERATOR_PATH env var
# or mounted into the container.

RUN groupadd -r playground && useradd -r -g playground playground
USER playground

ENV ASPNETCORE_URLS=http://+:5174
ENV DOTNET_ENVIRONMENT=Production

EXPOSE 5174
ENTRYPOINT ["dotnet", "playground-server.dll"]
