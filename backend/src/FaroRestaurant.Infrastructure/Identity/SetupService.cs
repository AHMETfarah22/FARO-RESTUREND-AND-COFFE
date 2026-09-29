using System.Text.RegularExpressions;
using FaroRestaurant.Application.Auth;
using FaroRestaurant.Application.Common.Exceptions;
using FaroRestaurant.Application.Setup;
using FaroRestaurant.Domain.Constants;
using FaroRestaurant.Domain.Entities;
using FaroRestaurant.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FaroRestaurant.Infrastructure.Identity;

public class SetupService(
    AppDbContext db,
    UserManager<ApplicationUser> userManager,
    RoleManager<ApplicationRole> roleManager,
    IAuthService auth,
    ILogger<SetupService> logger) : ISetupService
{
    /// <summary>Two browsers finishing setup at the same moment must not both create an administrator.</summary>
    private static readonly SemaphoreSlim Gate = new(1, 1);

    public async Task<SetupStatusDto> GetStatusAsync(CancellationToken cancellationToken = default) =>
        new(!await userManager.Users.AnyAsync(cancellationToken));

    public async Task<AuthResponse> CompleteAsync(CompleteSetupRequest request, CancellationToken cancellationToken = default)
    {
        await Gate.WaitAsync(cancellationToken);
        try
        {
            // Only for a new installation: afterwards accounts are managed from Staff Management.
            if (await userManager.Users.AnyAsync(cancellationToken))
                throw new ConflictException("Setup has already been completed. Please sign in.");

            await IdentityRoles.EnsureCreatedAsync(roleManager, logger);

            var name = request.RestaurantName.Trim();
            var restaurant = await db.Restaurants.OrderBy(r => r.CreatedAt).FirstOrDefaultAsync(cancellationToken);
            if (restaurant is null)
            {
                var slug = Regex.Replace(name.ToLowerInvariant(), "[^a-z0-9]+", "-").Trim('-');
                restaurant = new Restaurant
                {
                    Name = name,
                    Slug = slug.Length > 0 ? slug : "restaurant",
                    OpeningTime = new TimeOnly(8, 0),
                    ClosingTime = new TimeOnly(23, 0),
                    Currency = Brand.DefaultCurrency,
                    TaxRate = Brand.DefaultTaxRate,
                };
                db.Restaurants.Add(restaurant);
            }
            else restaurant.Name = name;
            await db.SaveChangesAsync(cancellationToken);

            var email = request.Email.Trim().ToLowerInvariant();
            var admin = new ApplicationUser
            {
                UserName = email,
                Email = email,
                EmailConfirmed = true,
                FullName = request.FullName.Trim(),
                RestaurantId = restaurant.Id,
            };
            IdentityService.ThrowIfFailed(await userManager.CreateAsync(admin, request.Password));
            IdentityService.ThrowIfFailed(await userManager.AddToRoleAsync(admin, Roles.SuperAdmin));
            logger.LogInformation("Setup completed: restaurant {Restaurant}, administrator {Email}", restaurant.Name, email);

            return await auth.LoginAsync(new LoginRequest(email, request.Password), cancellationToken);
        }
        finally
        {
            Gate.Release();
        }
    }
}
