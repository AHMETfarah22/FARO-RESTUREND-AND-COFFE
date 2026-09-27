using FaroRestaurant.Application.Common.Exceptions;
using FaroRestaurant.Application.Common.Interfaces;
using FaroRestaurant.Application.Auth;
using FaroRestaurant.Domain.Constants;
using FaroRestaurant.Domain.Entities;
using FluentValidation;
using ValidationException = FaroRestaurant.Application.Common.Exceptions.ValidationException;
using Microsoft.EntityFrameworkCore;

namespace FaroRestaurant.Application.Staff;

public sealed record StaffDto(
    Guid Id,
    Guid UserId,
    string FullName,
    string Email,
    string UserName,
    string? Phone,
    string Role,
    bool IsActive,
    DateOnly HiredOn,
    DateTime CreatedAt);

public sealed record CreateStaffRequest(string FullName, string Email, string UserName, string? Phone, string Role, string Password, bool IsActive);

public sealed record UpdateStaffRequest(string FullName, string Email, string UserName, string? Phone, string Role, bool IsActive);

public sealed record ResetStaffPasswordRequest(string NewPassword);

public interface IStaffService
{
    Task<IReadOnlyList<StaffDto>> ListAsync(CancellationToken cancellationToken = default);
    Task<StaffDto> CreateAsync(CreateStaffRequest request, CancellationToken cancellationToken = default);
    Task<StaffDto> UpdateAsync(Guid id, UpdateStaffRequest request, CancellationToken cancellationToken = default);
    Task ResetPasswordAsync(Guid id, string newPassword, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}

public class StaffService(
    IAppDbContext db,
    IRestaurantScope scope,
    IIdentityService identity,
    ICurrentUser currentUser,
    IClock clock) : IStaffService
{
    public async Task<IReadOnlyList<StaffDto>> ListAsync(CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        var staff = await db.Staff.AsNoTracking()
            .Where(s => s.RestaurantId == restaurantId)
            .OrderBy(s => s.Role).ThenBy(s => s.FullName)
            .ToListAsync(cancellationToken);

        var result = new List<StaffDto>(staff.Count);
        foreach (var s in staff) result.Add(await ToDtoAsync(s, cancellationToken));
        return result;
    }

    public async Task<StaffDto> CreateAsync(CreateStaffRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRoleAssignable(request.Role);
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);

        var userId = await identity.CreateUserAsync(new CreateUserCommand(
            request.FullName.Trim(), request.Email.Trim(), request.UserName.Trim(), request.Phone, request.Password, request.Role, restaurantId),
            cancellationToken);

        var member = new StaffMember
        {
            RestaurantId = restaurantId,
            UserId = userId,
            FullName = request.FullName.Trim(),
            Email = request.Email.Trim().ToLowerInvariant(),
            Phone = request.Phone,
            Role = request.Role,
            IsActive = request.IsActive,
            HiredOn = clock.Today,
        };
        db.Staff.Add(member);
        await db.SaveChangesAsync(cancellationToken);

        if (!request.IsActive)
            await identity.UpdateUserAsync(new UpdateUserCommand(userId, member.FullName, member.Email, request.UserName, member.Phone, member.Role, false), cancellationToken);

        return await ToDtoAsync(member, cancellationToken);
    }

    public async Task<StaffDto> UpdateAsync(Guid id, UpdateStaffRequest request, CancellationToken cancellationToken = default)
    {
        EnsureRoleAssignable(request.Role);
        var member = await FindAsync(id, cancellationToken);
        if (member.UserId == currentUser.UserId && !request.IsActive)
            throw new ConflictException("You cannot deactivate your own account.");

        await identity.UpdateUserAsync(new UpdateUserCommand(
            member.UserId, request.FullName.Trim(), request.Email.Trim(), request.UserName.Trim(), request.Phone, request.Role, request.IsActive),
            cancellationToken);

        member.FullName = request.FullName.Trim();
        member.Email = request.Email.Trim().ToLowerInvariant();
        member.Phone = request.Phone;
        member.Role = request.Role;
        member.IsActive = request.IsActive;
        await db.SaveChangesAsync(cancellationToken);
        return await ToDtoAsync(member, cancellationToken);
    }

    public async Task ResetPasswordAsync(Guid id, string newPassword, CancellationToken cancellationToken = default)
    {
        var member = await FindAsync(id, cancellationToken);
        await identity.ResetPasswordAsync(member.UserId, newPassword, cancellationToken);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var member = await FindAsync(id, cancellationToken);
        if (member.UserId == currentUser.UserId) throw new ConflictException("You cannot delete your own account.");
        db.Staff.Remove(member);
        await db.SaveChangesAsync(cancellationToken);
        await identity.DeleteUserAsync(member.UserId, cancellationToken);
    }

    private static void EnsureRoleAssignable(string role)
    {
        if (!Roles.Staff.Contains(role))
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["role"] = [$"Role must be one of: {string.Join(", ", Roles.Staff)}."]
            });
    }

    private async Task<StaffMember> FindAsync(Guid id, CancellationToken cancellationToken)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        return await db.Staff.FirstOrDefaultAsync(s => s.Id == id && s.RestaurantId == restaurantId, cancellationToken)
               ?? throw new NotFoundException("Staff member", id);
    }

    private async Task<StaffDto> ToDtoAsync(StaffMember s, CancellationToken cancellationToken) => new(
        s.Id, s.UserId, s.FullName, s.Email, await identity.GetUserNameAsync(s.UserId, cancellationToken) ?? s.Email,
        s.Phone, s.Role, s.IsActive, s.HiredOn, s.CreatedAt);
}

public class CreateStaffRequestValidator : AbstractValidator<CreateStaffRequest>
{
    public CreateStaffRequestValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(150);
        RuleFor(x => x.UserName).NotEmpty().MaximumLength(60).Matches("^[a-zA-Z0-9._@-]+$")
            .WithMessage("Username may contain letters, digits and . _ @ - only.");
        RuleFor(x => x.Phone).MaximumLength(30);
        RuleFor(x => x.Role).NotEmpty();
        RuleFor(x => x.Password).StrongPassword();
    }
}

public class UpdateStaffRequestValidator : AbstractValidator<UpdateStaffRequest>
{
    public UpdateStaffRequestValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(150);
        RuleFor(x => x.UserName).NotEmpty().MaximumLength(60).Matches("^[a-zA-Z0-9._@-]+$")
            .WithMessage("Username may contain letters, digits and . _ @ - only.");
        RuleFor(x => x.Phone).MaximumLength(30);
        RuleFor(x => x.Role).NotEmpty();
    }
}

public class ResetStaffPasswordRequestValidator : AbstractValidator<ResetStaffPasswordRequest>
{
    public ResetStaffPasswordRequestValidator() => RuleFor(x => x.NewPassword).StrongPassword();
}
