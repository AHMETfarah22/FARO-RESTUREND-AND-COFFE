using System.Security.Claims;
using System.Text;
using FaroRestaurant.Application.Auth;
using FaroRestaurant.Application.Common.Exceptions;
using FaroRestaurant.Application.Common.Interfaces;
using FaroRestaurant.Domain.Constants;
using FaroRestaurant.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace FaroRestaurant.Infrastructure.Identity;

public class AuthService(
    UserManager<ApplicationUser> userManager,
    IOptions<JwtOptions> jwtOptions,
    ICurrentUser currentUser,
    IRestaurantScope scope,
    IAppDbContext db) : IAuthService
{
    private const string InvalidCredentials = "Invalid email or password.";

    public async Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        var login = request.Email.Trim();
        var user = await userManager.FindByEmailAsync(login) ?? await userManager.FindByNameAsync(login);

        // Same message for unknown user and wrong password, so accounts can't be enumerated.
        if (user is null) throw new UnauthorizedException(InvalidCredentials);
        if (await userManager.IsLockedOutAsync(user))
            throw new UnauthorizedException("Too many failed attempts. Try again in 15 minutes.");

        if (!await userManager.CheckPasswordAsync(user, request.Password))
        {
            await userManager.AccessFailedAsync(user);
            throw new UnauthorizedException(InvalidCredentials);
        }
        if (!user.IsActive) throw new UnauthorizedException("This account is disabled. Contact your manager.");

        await userManager.ResetAccessFailedCountAsync(user);
        user.LastLoginAt = DateTime.UtcNow;
        await userManager.UpdateAsync(user);

        return await CreateResponseAsync(user);
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (await userManager.FindByEmailAsync(email) is not null)
            throw new ConflictException("An account with this email already exists.");

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            FullName = request.FullName.Trim(),
            PhoneNumber = request.Phone,
        };
        IdentityService.ThrowIfFailed(await userManager.CreateAsync(user, request.Password));
        IdentityService.ThrowIfFailed(await userManager.AddToRoleAsync(user, Roles.Customer));

        // Link (or create) the customer record so orders placed with the same email/phone show in their history.
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        var phone = request.Phone?.Trim();
        var customer = await db.Customers.FirstOrDefaultAsync(c =>
            c.RestaurantId == restaurantId && (c.Email == email || (phone != null && phone != "" && c.Phone == phone)), cancellationToken);
        if (customer is null)
        {
            customer = new Customer { RestaurantId = restaurantId, Name = user.FullName, Email = email, Phone = string.IsNullOrEmpty(phone) ? null : phone };
            db.Customers.Add(customer);
        }
        customer.UserId = user.Id;
        await db.SaveChangesAsync(cancellationToken);

        return await CreateResponseAsync(user);
    }

    public async Task<UserDto> GetCurrentUserAsync(CancellationToken cancellationToken = default) =>
        await ToDtoAsync(await GetUserAsync());

    public async Task<UserDto> UpdateProfileAsync(UpdateProfileRequest request, CancellationToken cancellationToken = default)
    {
        var user = await GetUserAsync();
        user.FullName = request.FullName.Trim();
        user.PhoneNumber = request.Phone;
        IdentityService.ThrowIfFailed(await userManager.UpdateAsync(user));

        var staff = await db.Staff.FirstOrDefaultAsync(s => s.UserId == user.Id, cancellationToken);
        if (staff is not null)
        {
            staff.FullName = user.FullName;
            staff.Phone = user.PhoneNumber;
            await db.SaveChangesAsync(cancellationToken);
        }
        return await ToDtoAsync(user);
    }

    public async Task ChangePasswordAsync(ChangePasswordRequest request, CancellationToken cancellationToken = default)
    {
        var user = await GetUserAsync();
        var result = await userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded && result.Errors.Any(e => e.Code == "PasswordMismatch"))
            throw new ValidationException(new Dictionary<string, string[]> { ["currentPassword"] = ["Current password is incorrect."] });
        IdentityService.ThrowIfFailed(result);
    }

    private async Task<ApplicationUser> GetUserAsync()
    {
        var id = currentUser.UserId ?? throw new UnauthorizedException("Not signed in.");
        return await userManager.FindByIdAsync(id.ToString()) ?? throw new UnauthorizedException("Account no longer exists.");
    }

    private async Task<UserDto> ToDtoAsync(ApplicationUser user)
    {
        var roles = await userManager.GetRolesAsync(user);
        return new UserDto(user.Id, user.FullName, user.Email!, user.UserName!, user.PhoneNumber, roles.ToList(), user.RestaurantId);
    }

    private async Task<AuthResponse> CreateResponseAsync(ApplicationUser user)
    {
        var dto = await ToDtoAsync(user);
        var options = jwtOptions.Value;
        var expires = DateTime.UtcNow.AddMinutes(options.ExpiresMinutes);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email!),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(AppClaims.FullName, user.FullName),
            // Lets the API reject tokens issued before a password/role change or deactivation.
            new(AppClaims.SecurityStamp, user.SecurityStamp ?? string.Empty),
        };
        if (user.RestaurantId is { } restaurantId) claims.Add(new Claim(AppClaims.RestaurantId, restaurantId.ToString()));
        claims.AddRange(dto.Roles.Select(r => new Claim(ClaimTypes.Role, r)));

        var token = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Issuer = options.Issuer,
            Audience = options.Audience,
            Expires = expires,
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.Secret)), SecurityAlgorithms.HmacSha256),
        });

        return new AuthResponse(token, expires, dto);
    }
}
