using System.Data.Common;
using System.Diagnostics.CodeAnalysis;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace NexusPOS.SharedKernel.Infrastructure.Persistence;

public sealed class TenantSchemaInterceptor(ITenantContext tenantContext) : DbConnectionInterceptor
{
    private static readonly Regex _schemaPattern = new(@"^[a-z0-9_]+$", RegexOptions.Compiled);

    public override async Task ConnectionOpenedAsync(
        DbConnection connection,
        ConnectionEndEventData eventData,
        CancellationToken cancellationToken = default)
    {
        if (!tenantContext.IsAuthenticated || string.IsNullOrEmpty(tenantContext.SchemaName))
        {
            return;
        }

        ValidateSchemaName(tenantContext.SchemaName);
        await using var cmd = connection.CreateCommand();
        SetSchemaPath(cmd, tenantContext.SchemaName);
        await cmd.ExecuteNonQueryAsync(cancellationToken);
    }

    public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
    {
        if (!tenantContext.IsAuthenticated || string.IsNullOrEmpty(tenantContext.SchemaName))
        {
            return;
        }

        ValidateSchemaName(tenantContext.SchemaName);
        using var cmd = connection.CreateCommand();
        SetSchemaPath(cmd, tenantContext.SchemaName);
        cmd.ExecuteNonQuery();
    }

    private static void ValidateSchemaName(string schemaName)
    {
        if (!_schemaPattern.IsMatch(schemaName))
        {
            throw new InvalidOperationException(
                $"Schema name '{schemaName}' contains invalid characters. Only lowercase letters, digits, and underscores are allowed.");
        }
    }

    [SuppressMessage("Security", "CA2100:Review SQL queries for security vulnerabilities",
        Justification = "Schema name is validated against a strict alphanumeric pattern before use.")]
    private static void SetSchemaPath(DbCommand cmd, string schemaName)
    {
        cmd.CommandText = $"SET search_path TO \"{schemaName}\", public";
    }
}
