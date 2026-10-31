using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using NexusPOS.IAM.Presentation;
using Scalar.AspNetCore;
using Serilog;

namespace NexusPOS.Api.Infrastructure;

internal static class PresentationServiceExtensions
{
    internal static IServiceCollection AddPresentation(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        IMvcBuilder mvcBuilder = services.AddControllers(options =>
                options.Filters.Add<TenantRouteGuardFilter>())
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

            options.OnRejected = (context, _) =>
            {
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out TimeSpan retryAfter))
                {
                    context.HttpContext.Response.Headers.RetryAfter =
                        ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString(CultureInfo.InvariantCulture);
                }

                return ValueTask.CompletedTask;
            };

            // Auth limits are partitioned per client IP; a single shared bucket let one busy minute
            // across all shops lock every other cashier out of login and token refresh.
            int trustedProxyHops = configuration.GetValue("RateLimit:TrustedProxyHops", 1);
            AddPerIpAuthPolicy(options, AuthRateLimiting.RegisterPolicy, configuration.GetValue("RateLimit:AuthEndpointsPerMinute", 10), trustedProxyHops);
            AddPerIpAuthPolicy(options, AuthRateLimiting.LoginPolicy, configuration.GetValue("RateLimit:LoginPerMinute", 20), trustedProxyHops);
            AddPerIpAuthPolicy(options, AuthRateLimiting.RefreshPolicy, configuration.GetValue("RateLimit:RefreshPerMinute", 120), trustedProxyHops);

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
                    .SetIsOriginAllowed(origin =>
                    {
                        if (allowedOrigins.Contains(origin)) { return true; }
                        Uri? uri = Uri.TryCreate(origin, UriKind.Absolute, out Uri? u) ? u : null;
                        if (uri is null) { return false; }
                        return uri.Host.EndsWith(".vercel.app", StringComparison.OrdinalIgnoreCase)
                            || uri.Host.EndsWith(".railway.app", StringComparison.OrdinalIgnoreCase);
                    })
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

    private static void AddPerIpAuthPolicy(RateLimiterOptions options, string policyName, int permitsPerMinute, int trustedProxyHops) =>
        options.AddPolicy(policyName, context => RateLimitPartition.GetSlidingWindowLimiter(
            AuthRateLimiting.ClientKey(context, trustedProxyHops),
            _ => new SlidingWindowRateLimiterOptions
            {
                Window = TimeSpan.FromMinutes(1),
                SegmentsPerWindow = 6,
                PermitLimit = permitsPerMinute,
                QueueLimit = 0,
            }));

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
