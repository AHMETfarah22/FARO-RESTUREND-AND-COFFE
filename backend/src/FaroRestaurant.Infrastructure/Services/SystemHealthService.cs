using FaroRestaurant.Application.Health;
using FaroRestaurant.Domain.Constants;
using FaroRestaurant.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace FaroRestaurant.Infrastructure.Services;

public class SystemHealthService(
    AppDbContext db,
    IHostEnvironment environment,
    ILogger<SystemHealthService> logger) : ISystemHealthService
{
    public async Task<SystemHealthDto> GetHealthAsync(CancellationToken cancellationToken = default)
    {
        var database = await CheckDatabaseAsync(cancellationToken);

        return new SystemHealthDto(
            Application: Brand.Name,
            Status: database.Connected && database.PendingMigrations == 0 ? "Healthy" : "Degraded",
            Environment: environment.EnvironmentName,
            Database: database,
            ServerTimeUtc: DateTime.UtcNow);
    }

    private async Task<DatabaseHealthDto> CheckDatabaseAsync(CancellationToken cancellationToken)
    {
        try
        {
            if (!await db.Database.CanConnectAsync(cancellationToken))
                return Failed("Cannot connect to the database.");

            var connection = db.Database.GetDbConnection();
            if (connection.State != System.Data.ConnectionState.Open)
                await db.Database.OpenConnectionAsync(cancellationToken);

            try
            {
                var serverVersion = connection.ServerVersion;
                var pending = (await db.Database.GetPendingMigrationsAsync(cancellationToken)).Count();

                // Row counts are only meaningful once the schema exists.
                var restaurants = pending == 0 ? await db.Restaurants.CountAsync(cancellationToken) : 0;
                var roles = pending == 0 ? await db.Roles.CountAsync(cancellationToken) : 0;

                return new DatabaseHealthDto(true, "PostgreSQL", serverVersion, pending, restaurants, roles, null);
            }
            finally
            {
                await db.Database.CloseConnectionAsync();
            }
        }
        catch (Exception ex)
        {
            // Log details server-side; never leak connection details to the client.
            logger.LogWarning(ex, "Database health check failed");
            return Failed("Database health check failed. See server logs for details.");
        }
    }

    private static DatabaseHealthDto Failed(string error) =>
        new(false, "PostgreSQL", null, 0, 0, 0, error);
}
