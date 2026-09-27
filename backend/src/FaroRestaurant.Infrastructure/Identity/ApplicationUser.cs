using Microsoft.AspNetCore.Identity;

namespace FaroRestaurant.Infrastructure.Identity;

/// <summary>
/// Authentication account. Passwords are stored only as salted PBKDF2 hashes by ASP.NET Core Identity.
/// </summary>
public class ApplicationUser : IdentityUser<Guid>
{
    public string FullName { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }

    /// <summary>Restaurant the user works for. Null for super admins and customers.</summary>
    public Guid? RestaurantId { get; set; }
}
