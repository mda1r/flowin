using FluentValidation;
using MediatR;
using NexusPOS.SharedKernel.Application.Behaviors;

namespace NexusPOS.Api.Infrastructure;

internal static class ApplicationServiceExtensions
{
    internal static IServiceCollection AddApplication(this IServiceCollection services)
    {
        var assemblies = ModuleAssemblies.All;

        services.AddMediatR(config =>
        {
            config.RegisterServicesFromAssemblies(assemblies);
        });

        // MediatR pipeline: Logging → Validation → Performance → Handler
        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(PerformanceBehavior<,>));

        services.AddValidatorsFromAssemblies(assemblies, includeInternalTypes: true);

        return services;
    }
}
