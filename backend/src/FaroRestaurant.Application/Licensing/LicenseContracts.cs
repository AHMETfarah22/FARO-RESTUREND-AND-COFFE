using FluentValidation;

namespace FaroRestaurant.Application.Licensing;

/// <summary>Whether this installation may be used.</summary>
public enum LicenseState { Active, Missing, Invalid, Expired, OtherMachine }

/// <summary>
/// What the activation screen and Settings → System show. <see cref="MachineCode"/> is what the customer
/// sends to the seller, who signs a license key for exactly this computer.
/// </summary>
public sealed record LicenseStatusDto(
    LicenseState Status,
    string MachineCode,
    string? Customer,
    string? LicenseId,
    DateOnly? IssuedOn,
    DateOnly? ExpiresOn);

public sealed record ActivateLicenseRequest(string Key);

public interface ILicenseService
{
    /// <summary>This computer's code, e.g. "2KZZ-ABAB-CGFK-TV9D".</summary>
    string MachineCode { get; }

    /// <summary>True while a valid, unexpired license for this computer is installed.</summary>
    bool IsActive { get; }

    LicenseStatusDto GetStatus();

    /// <summary>Verifies and stores a license key. Throws a validation error when the key is not valid here.</summary>
    LicenseStatusDto Activate(string key);
}

public class ActivateLicenseRequestValidator : AbstractValidator<ActivateLicenseRequest>
{
    public ActivateLicenseRequestValidator() => RuleFor(x => x.Key).NotEmpty().MaximumLength(4000);
}
