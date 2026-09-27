namespace FaroRestaurant.Application.Health;

public sealed record SystemHealthDto(
    string Application,
    string Status,
    string Environment,
    DatabaseHealthDto Database,
    DateTime ServerTimeUtc);

public sealed record DatabaseHealthDto(
    bool Connected,
    string Provider,
    string? ServerVersion,
    int PendingMigrations,
    int RestaurantCount,
    int RoleCount,
    string? Error);
