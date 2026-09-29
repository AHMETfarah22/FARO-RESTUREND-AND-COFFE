using FaroRestaurant.Application.Auth;
using FluentValidation;

namespace FaroRestaurant.Application.Setup;

/// <summary>True on a brand-new installation (no accounts yet): the portal then asks for the restaurant and its administrator.</summary>
public sealed record SetupStatusDto(bool Required);

public sealed record CompleteSetupRequest(string RestaurantName, string FullName, string Email, string Password);

/// <summary>
/// First run of a real installation. The development seeder creates test accounts; a customer's installation
/// starts empty and creates its first administrator here instead.
/// </summary>
public interface ISetupService
{
    Task<SetupStatusDto> GetStatusAsync(CancellationToken cancellationToken = default);

    /// <summary>Creates the roles, the restaurant and the administrator, then signs the administrator in.</summary>
    Task<AuthResponse> CompleteAsync(CompleteSetupRequest request, CancellationToken cancellationToken = default);
}

public class CompleteSetupRequestValidator : AbstractValidator<CompleteSetupRequest>
{
    public CompleteSetupRequestValidator()
    {
        RuleFor(x => x.RestaurantName).NotEmpty().MaximumLength(150);
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(150);
        RuleFor(x => x.Password).StrongPassword();
    }
}
