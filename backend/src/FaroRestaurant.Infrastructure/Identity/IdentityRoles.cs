using FaroRestaurant.Domain.Constants;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;

namespace FaroRestaurant.Infrastructure.Identity;

/// <summary>Creates the fixed role set (used by the development seeder and by first-run setup).</summary>
public static class IdentityRoles
{
    private static readonly Dictionary<string, string> Descriptions = new()
    {
        [Roles.SuperAdmin] = "Full access to all restaurants, users and system settings",
        [Roles.RestaurantAdmin] = "Manages a restaurant: menu, tables, staff, inventory and reports",
        [Roles.Manager] = "Day-to-day operations: orders, reservations, staff and reports",
        [Roles.Waiter] = "Views tables, creates and updates orders",
        [Roles.Kitchen] = "Kitchen display: accepts, prepares and completes orders",
        [Roles.Cashier] = "Processes payments, closes orders and prints receipts",
        [Roles.Customer] = "Uses the QR menu, places orders and tracks their status",
    };

    public static async Task EnsureCreatedAsync(RoleManager<ApplicationRole> roleManager, ILogger logger)
    {
        foreach (var roleName in Roles.All)
        {
            if (await roleManager.RoleExistsAsync(roleName)) continue;
            var result = await roleManager.CreateAsync(new ApplicationRole(roleName) { Description = Descriptions.GetValueOrDefault(roleName) });
            if (!result.Succeeded)
                throw new InvalidOperationException($"Failed to create role '{roleName}': {string.Join("; ", result.Errors.Select(e => e.Description))}");
            logger.LogInformation("Created role {Role}", roleName);
        }
    }
}
