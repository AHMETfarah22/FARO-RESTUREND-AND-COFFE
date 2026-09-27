using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using FaroRestaurant.Api.Filters;
using FaroRestaurant.Api.Middleware;
using FaroRestaurant.Api.Realtime;
using FaroRestaurant.Api.Services;
using FaroRestaurant.Application.Common.Interfaces;

namespace FaroRestaurant.Api.Extensions;

public static class ApiServiceExtensions
{
    public const string CorsPolicy = "Frontend";
    public const string AuthRateLimitPolicy = "auth";
    public const string PublicOrderRateLimitPolicy = "public-order";

    public static IServiceCollection AddApiServices(this IServiceCollection services, IConfiguration configuration)
    {
        services
            .AddControllers(options => options.Filters.Add<ValidationFilter>())
            .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

        services.AddSignalR()
            .AddJsonProtocol(o => o.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, CurrentUser>();
        services.AddScoped<IRealtimeNotifier, SignalRNotifier>();

        services.AddJwtAuthentication(configuration);
        services.AddOpenApi();
        services.AddProblemDetails();
        services.AddExceptionHandler<GlobalExceptionHandler>();

        services.AddFrontendCors(configuration);
        services.AddRateLimiting();

        return services;
    }

    private static void AddFrontendCors(this IServiceCollection services, IConfiguration configuration)
    {
        // Comma-separated list, e.g. "http://localhost:5173,https://portal.example.com"
        var origins = (configuration["Cors:AllowedOrigins"] ?? "http://localhost:5173")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        services.AddCors(options => options.AddPolicy(CorsPolicy, policy => policy
            .WithOrigins(origins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .WithExposedHeaders("Content-Disposition")
            .AllowCredentials())); // required for SignalR
    }

    private static void AddRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            // Global limit per client IP.
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    ClientKey(context),
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = 600, Window = TimeSpan.FromMinutes(1) }));

            // Stricter limit for login/register to slow down brute-force attempts.
            options.AddPolicy(AuthRateLimitPolicy, context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    ClientKey(context),
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));

            // Anonymous QR orders: prevents order spam from a single device.
            options.AddPolicy(PublicOrderRateLimitPolicy, context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    ClientKey(context),
                    _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(5) }));
        });
    }

    private static string ClientKey(HttpContext context) =>
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
}
