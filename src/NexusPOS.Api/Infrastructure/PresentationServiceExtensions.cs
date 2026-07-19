using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.RateLimiting;
using Scalar.AspNetCore;
using Serilog;

namespace NexusPOS.Api.Infrastructure;

internal static class PresentationServiceExtensions
{
    internal static IServiceCollection AddPresentation(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        IMvcBuilder mvcBuilder = services.AddControllers()
            .AddJsonOptions(options =>
            {
                options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
                options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
                options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
            });

        foreach (System.Reflection.Assembly assembly in ModuleAssemblies.All)
        {
            mvcBuilder.AddApplicationPart(assembly);
        }

        services.AddOpenApi(options =>
        {
            options.AddDocumentTransformer((document, _, _) =>
            {
                document.Info = new()
                {
                    Title = "NexusPOS Enterprise API",
                    Version = "v1",
                    Description = "NexusPOS — Multi-Tenant POS & Business Management Platform API"
                };
                return Task.CompletedTask;
            });
        });

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            options.AddSlidingWindowLimiter("auth", limiterOptions =>
            {
                limiterOptions.Window = TimeSpan.FromMinutes(1);
                limiterOptions.SegmentsPerWindow = 6;
                limiterOptions.PermitLimit = configuration.GetValue("RateLimit:AuthEndpointsPerMinute", 10);
                limiterOptions.QueueLimit = 0;
            });

            options.AddSlidingWindowLimiter("general", limiterOptions =>
            {
                limiterOptions.Window = TimeSpan.FromMinutes(1);
                limiterOptions.SegmentsPerWindow = 6;
                limiterOptions.PermitLimit = configuration.GetValue("RateLimit:GeneralEndpointsPerMinute", 300);
                limiterOptions.QueueLimit = 5;
            });
        });

        services.AddCors(options =>
        {
            options.AddPolicy("NexusPOSCors", policy =>
            {
                string[] allowedOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                    ?? ["http://localhost:1420", "http://localhost:3000", "http://localhost:5173", "tauri://localhost"];

                policy
                    .WithOrigins(allowedOrigins)
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            });
        });

        services.AddSignalR();

        services.AddProblemDetails();
        services.AddExceptionHandler<GlobalExceptionHandler>();

        return services;
    }

    internal static async Task ConfigurePipelineAsync(this WebApplication app)
    {
        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi();
            app.MapScalarApiReference(options =>
            {
                options.Title = "NexusPOS API";
                options.Theme = ScalarTheme.Default;
            });
        }

        app.UseExceptionHandler();
        app.UseStatusCodePages();

        app.UseSerilogRequestLogging(options =>
        {
            options.MessageTemplate =
                "HTTP {RequestMethod} {RequestPath} responded {StatusCode} in {Elapsed:0.0000}ms";
        });

        app.UseCors("NexusPOSCors");
        app.UseRateLimiter();

        app.UseAuthentication();
        app.UseAuthorization();
        app.UseTenantContext();

        app.UseHealthChecks("/health", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
        {
            ResponseWriter = HealthChecks.UI.Client.UIResponseWriter.WriteHealthCheckUIResponse
        });

        app.UseHealthChecks("/health/live", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
        {
            Predicate = check => check.Tags.Contains("live")
        });

        app.UseHealthChecks("/health/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
        {
            Predicate = check => check.Tags.Contains("ready")
        });

        app.MapPrometheusScrapingEndpoint("/metrics");

        app.MapControllers();

        await app.InitializeDatabasesAsync();
    }
}
