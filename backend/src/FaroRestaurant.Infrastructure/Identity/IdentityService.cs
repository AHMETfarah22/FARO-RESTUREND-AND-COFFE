using FaroRestaurant.Application.Common.Exceptions;
using FaroRestaurant.Application.Common.Interfaces;
using Microsoft.AspNetCore.Identity;

namespace FaroRestaurant.Infrastructure.Identity;

public class IdentityService(UserManager<ApplicationUser> userManager) : IIdentityService
{
    public async Task<Guid> CreateUserAsync(CreateUserCommand command, CancellationToken cancellationToken = default)
    {
        var email = command.Email.Trim().ToLowerInvariant();
        if (await userManager.FindByEmailAsync(email) is not null)
            throw new ConflictException("An account with this email already exists.");
        if (await userManager.FindByNameAsync(command.UserName) is not null)
            throw new ConflictException("This username is already taken.");

        var user = new ApplicationUser
        {
            UserName = command.UserName,
            Email = email,
            EmailConfirmed = true,
            FullName = command.FullName,
            PhoneNumber = command.Phone,
            RestaurantId = command.RestaurantId,
        };
        ThrowIfFailed(await userManager.CreateAsync(user, command.Password));
        ThrowIfFailed(await userManager.AddToRoleAsync(user, command.Role));
        return user.Id;
    }

    public async Task UpdateUserAsync(UpdateUserCommand command, CancellationToken cancellationToken = default)
    {
        var user = await FindAsync(command.UserId);
        var email = command.Email.Trim().ToLowerInvariant();

        if (!string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase) &&
            await userManager.FindByEmailAsync(email) is not null)
            throw new ConflictException("An account with this email already exists.");
        if (!string.Equals(user.UserName, command.UserName, StringComparison.OrdinalIgnoreCase) &&
            await userManager.FindByNameAsync(command.UserName) is not null)
            throw new ConflictException("This username is already taken.");

        user.FullName = command.FullName;
        user.Email = email;
        user.UserName = command.UserName;
        user.PhoneNumber = command.Phone;
        user.IsActive = command.IsActive;
        ThrowIfFailed(await userManager.UpdateAsync(user));

        var roles = await userManager.GetRolesAsync(user);
        if (!roles.SequenceEqual([command.Role]))
        {
            ThrowIfFailed(await userManager.RemoveFromRolesAsync(user, roles));
            ThrowIfFailed(await userManager.AddToRoleAsync(user, command.Role));
        }

        // Invalidate existing sessions on deactivation / role change.
        await userManager.UpdateSecurityStampAsync(user);
    }

    public async Task ResetPasswordAsync(Guid userId, string newPassword, CancellationToken cancellationToken = default)
    {
        var user = await FindAsync(userId);
        var token = await userManager.GeneratePasswordResetTokenAsync(user);
        ThrowIfFailed(await userManager.ResetPasswordAsync(user, token, newPassword));
    }

    public async Task DeleteUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user is not null) ThrowIfFailed(await userManager.DeleteAsync(user));
    }

    public async Task<string?> GetUserNameAsync(Guid userId, CancellationToken cancellationToken = default) =>
        (await userManager.FindByIdAsync(userId.ToString()))?.UserName;

    private async Task<ApplicationUser> FindAsync(Guid id) =>
        await userManager.FindByIdAsync(id.ToString()) ?? throw new NotFoundException("User", id);

    internal static void ThrowIfFailed(IdentityResult result)
    {
        if (result.Succeeded) return;
        throw new ValidationException(new Dictionary<string, string[]>
        {
            ["account"] = result.Errors.Select(e => e.Description).ToArray()
        });
    }
}
