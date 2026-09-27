using FaroRestaurant.Application.Auth;
using FaroRestaurant.Application.Common.Interfaces;
using FaroRestaurant.Application.Health;
using FaroRestaurant.Infrastructure.Identity;
using FaroRestaurant.Infrastructure.Notifications;
using FaroRestaurant.Infrastructure.Payments;
using FaroRestaurant.Infrastructure.Persistence;
using FaroRestaurant.Infrastructure.Persistence.Seed;
using FaroRestaurant.Infrastructure.Reports;
using FaroRestaurant.Infrastructure.Services;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace FaroRestaurant.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException(
                "Connection string 'DefaultConnection' is missing. " +
                "Set ConnectionStrings__DefaultConnection in backend/.env (see backend/.env.example).");

        services.AddDbContext<AppDbContext>(options => options
            .UseNpgsql(connectionString, npgsql => npgsql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName))
            .UseSnakeCaseNamingConvention());
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

        // Required by Identity token providers (password reset, email confirmation).
        services.AddDataProtection();

        services
            .AddIdentityCore<ApplicationUser>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.User.AllowedUserNameCharacters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._@+";
                options.Password.RequiredLength = 8;
                options.Password.RequireDigit = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireNonAlphanumeric = true;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
                options.Lockout.AllowedForNewUsers = true;
            })
            .AddRoles<ApplicationRole>()
            .AddEntityFrameworkStores<AppDbContext>()
            .AddDefaultTokenProviders();

        services.AddOptions<JwtOptions>()
            .Bind(configuration.GetSection(JwtOptions.SectionName))
            .Validate(o => o.Secret.Length >= 32, "Jwt:Secret must be at least 32 characters (set Jwt__Secret in backend/.env).")
            .ValidateOnStart();

        services.Configure<WebPushOptions>(configuration.GetSection(WebPushOptions.SectionName));
        services.AddScoped<ICustomerPushNotifier, WebPushCustomerNotifier>();

        services.AddSingleton<IClock, Clock>();
        services.AddSingleton<IPaymentGateway, SimulatedPaymentGateway>();
        services.AddSingleton<IReportExporter, ReportExporter>();
        services.AddScoped<IIdentityService, IdentityService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<DbSeeder>();
        services.AddScoped<ISystemHealthService, SystemHealthService>();

        return services;
    }
}
