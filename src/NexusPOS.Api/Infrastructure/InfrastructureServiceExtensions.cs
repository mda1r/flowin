using System.Security.Cryptography;
using Elastic.Clients.Elasticsearch;
using MassTransit;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using NexusPOS.SharedKernel.Infrastructure.Persistence;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using StackExchange.Redis;

namespace NexusPOS.Api.Infrastructure;

internal static class InfrastructureServiceExtensions
{
    internal static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services
            .AddTenantContext()
            .AddRedis(configuration)
            .AddMessageBus(configuration)
            .AddElasticsearch(configuration)
            .AddJwtAuthentication(configuration)
            .AddHealthChecks(configuration)
            .AddObservability(configuration);

        return services;
    }

    private static IServiceCollection AddTenantContext(this IServiceCollection services)
    {
        services.AddScoped<MutableTenantContext>();
        services.AddScoped<ITenantContext>(sp => sp.GetRequiredService<MutableTenantContext>());
        services.AddScoped<TenantSchemaInterceptor>();
        return services;
    }

    private static IServiceCollection AddRedis(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        string connectionString = configuration.GetConnectionString("Redis")
            ?? "localhost:6379,abortConnect=false";

        try
        {
            var options = ConfigurationOptions.Parse(connectionString);
            options.AbortOnConnectFail = false;
            options.ConnectTimeout = 3000;
            var mux = ConnectionMultiplexer.Connect(options);
            if (mux.IsConnected)
            {
                services.AddSingleton<IConnectionMultiplexer>(mux);
                services.AddStackExchangeRedisCache(o =>
                {
                    o.Configuration = connectionString;
                    o.InstanceName = "nexuspos:";
                });
                return services;
            }
        }
        catch { /* Redis not available */ }

        services.AddDistributedMemoryCache();
        return services;
    }

    private static IServiceCollection AddMessageBus(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        bool useInMemory = configuration.GetValue("MessageBus:UseInMemory", false);

        services.AddMassTransit(x =>
        {
            x.SetKebabCaseEndpointNameFormatter();

            if (useInMemory)
            {
                x.UsingInMemory((context, cfg) => cfg.ConfigureEndpoints(context));
            }
            else
            {
                x.UsingRabbitMq((context, cfg) =>
                {
                    cfg.Host(
                        configuration["RabbitMQ:Host"] ?? "localhost",
                        (ushort)configuration.GetValue("RabbitMQ:Port", 5672),
                        configuration["RabbitMQ:VirtualHost"] ?? "nexuspos",
                        h =>
                        {
                            h.Username(configuration["RabbitMQ:Username"] ?? "nexuspos");
                            h.Password(configuration["RabbitMQ:Password"] ?? string.Empty);
                        });

                    cfg.UseMessageRetry(r => r.Exponential(5,
                        TimeSpan.FromSeconds(1),
                        TimeSpan.FromSeconds(30),
                        TimeSpan.FromSeconds(2)));

                    cfg.ConfigureEndpoints(context);
                });
            }
        });

        return services;
    }

    private static IServiceCollection AddElasticsearch(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        string url = configuration["Elasticsearch:Url"] ?? "http://localhost:9200";

        var settings = new ElasticsearchClientSettings(new Uri(url))
            .DefaultIndex("nexuspos")
            .RequestTimeout(TimeSpan.FromSeconds(5));

        services.AddSingleton(new ElasticsearchClient(settings));

        return services;
    }

    private static IServiceCollection AddJwtAuthentication(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        RsaSecurityKey signingKey = CreateRsaSigningKey(configuration);
        services.AddSingleton(signingKey);

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = configuration["Jwt:Issuer"],
                    ValidAudience = configuration["Jwt:Audience"],
                    IssuerSigningKey = signingKey,
                    ClockSkew = TimeSpan.FromSeconds(30)
                };
                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        var accessToken = context.Request.Query["access_token"];
                        var path = context.HttpContext.Request.Path;
                        if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                        {
                            context.Token = accessToken;
                        }
                        return Task.CompletedTask;
                    }
                };
            });

        services.AddAuthorization(options =>
        {
            options.AddPolicy("SuperAdmin", policy =>
                policy.RequireRole("SuperAdmin"));
            options.AddPolicy("TenantUser", policy =>
                policy.RequireAuthenticatedUser()
                      .RequireClaim("tenant_id"));
            options.AddPolicy("OwnerOrManager", policy =>
                policy.RequireClaim("tenant_id")
                      .RequireRole("Owner", "Manager"));
        });

        return services;
    }

    private static RsaSecurityKey CreateRsaSigningKey(IConfiguration configuration)
    {
        RSA rsa = RSA.Create(2048);
        string? privateKeyPem = configuration["Jwt:PrivateKeyPem"];
        if (!string.IsNullOrEmpty(privateKeyPem))
        {
            rsa.ImportFromPem(privateKeyPem.AsSpan());
        }

        return new RsaSecurityKey(rsa) { KeyId = "nexuspos-jwt-key-v1" };
    }

    private static IServiceCollection AddHealthChecks(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        string pgConn = configuration.GetConnectionString("PostgreSQL") ?? string.Empty;

        services.AddHealthChecks()
            .AddNpgSql(pgConn, name: "postgresql", tags: ["ready", "db"])
            .AddCheck("live", () => Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Healthy(),
                tags: ["live"]);

        return services;
    }

    private static IServiceCollection AddObservability(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        string serviceName = configuration["OpenTelemetry:ServiceName"] ?? "nexuspos-api";
        string serviceVersion = configuration["OpenTelemetry:ServiceVersion"] ?? "1.0.0";
        string endpoint = configuration["OpenTelemetry:Endpoint"] ?? "http://localhost:4317";

        services.AddOpenTelemetry()
            .ConfigureResource(resource =>
                resource.AddService(serviceName, serviceVersion: serviceVersion))
            .WithTracing(tracing =>
            {
                tracing
                    .AddAspNetCoreInstrumentation(options =>
                    {
                        options.RecordException = true;
                        options.Filter = ctx =>
                            !ctx.Request.Path.StartsWithSegments("/health") &&
                            !ctx.Request.Path.StartsWithSegments("/metrics");
                    })
                    .AddHttpClientInstrumentation()
                    .AddNpgsql();

                if (!string.IsNullOrEmpty(endpoint) && endpoint != "http://localhost:4317")
                {
                    tracing.AddOtlpExporter(options => options.Endpoint = new Uri(endpoint));
                }
            })
            .WithMetrics(metrics =>
                metrics
                    .AddAspNetCoreInstrumentation()
                    .AddHttpClientInstrumentation()
                    .AddRuntimeInstrumentation()
                    .AddPrometheusExporter());

        return services;
    }
}
