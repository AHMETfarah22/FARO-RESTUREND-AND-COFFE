using System.Text.RegularExpressions;
using FaroRestaurant.Application.Common.Exceptions;
using FaroRestaurant.Application.Common.Interfaces;
using FaroRestaurant.Domain.Entities;
using FaroRestaurant.Domain.Enums;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaroRestaurant.Application.Restaurants;

public sealed record RestaurantSettingsDto(
    bool QrOrderingEnabled,
    bool AutoConfirmQrOrders,
    string? QrMenuBaseUrl,
    int DefaultPreparationMinutes,
    bool NewOrderSound,
    bool LowStockAlerts,
    bool ReservationAlerts,
    IReadOnlyList<PaymentMethod> EnabledPaymentMethods);

public sealed record RestaurantDto(
    Guid Id,
    string Name,
    string Slug,
    string? LogoUrl,
    string? CoverImageUrl,
    string? Phone,
    string? Email,
    string? Address,
    string? Description,
    string OpeningTime,
    string ClosingTime,
    string Currency,
    decimal TaxRate,
    bool IsActive,
    RestaurantSettingsDto Settings);

public sealed record SaveRestaurantRequest(
    string Name,
    string? LogoUrl,
    string? CoverImageUrl,
    string? Phone,
    string? Email,
    string? Address,
    string? Description,
    string OpeningTime,
    string ClosingTime,
    string Currency,
    decimal TaxRate);

/// <summary>Branding that is safe to show before login (login page, QR menu).</summary>
public sealed record PublicRestaurantDto(string Name, string? LogoUrl, string? CoverImageUrl, string? Description);

public interface IRestaurantService
{
    Task<PublicRestaurantDto> GetPublicAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<RestaurantDto>> ListAsync(CancellationToken cancellationToken = default);
    Task<RestaurantDto> GetCurrentAsync(CancellationToken cancellationToken = default);
    Task<RestaurantDto> CreateAsync(SaveRestaurantRequest request, CancellationToken cancellationToken = default);
    Task<RestaurantDto> UpdateAsync(Guid id, SaveRestaurantRequest request, CancellationToken cancellationToken = default);
    Task<RestaurantDto> UpdateSettingsAsync(RestaurantSettingsDto request, CancellationToken cancellationToken = default);
    Task DeactivateAsync(Guid id, CancellationToken cancellationToken = default);
}

public class RestaurantService(IAppDbContext db, IRestaurantScope scope, ICurrentUser currentUser) : IRestaurantService
{
    public async Task<IReadOnlyList<RestaurantDto>> ListAsync(CancellationToken cancellationToken = default)
    {
        var restaurants = await db.Restaurants.AsNoTracking().OrderBy(r => r.Name).ToListAsync(cancellationToken);
        return restaurants.Select(ToDto).ToList();
    }

    public async Task<PublicRestaurantDto> GetPublicAsync(CancellationToken cancellationToken = default)
    {
        var r = await FindAsync(await scope.GetRestaurantIdAsync(cancellationToken), cancellationToken);
        return new PublicRestaurantDto(r.Name, r.LogoUrl, r.CoverImageUrl, r.Description);
    }

    public async Task<RestaurantDto> GetCurrentAsync(CancellationToken cancellationToken = default)
    {
        var id = await scope.GetRestaurantIdAsync(cancellationToken);
        return ToDto(await FindAsync(id, cancellationToken));
    }

    public async Task<RestaurantDto> CreateAsync(SaveRestaurantRequest request, CancellationToken cancellationToken = default)
    {
        var restaurant = new Restaurant();
        Apply(restaurant, request);
        restaurant.Slug = await UniqueSlugAsync(request.Name, null, cancellationToken);
        db.Restaurants.Add(restaurant);
        await db.SaveChangesAsync(cancellationToken);
        return ToDto(restaurant);
    }

    public async Task<RestaurantDto> UpdateAsync(Guid id, SaveRestaurantRequest request, CancellationToken cancellationToken = default)
    {
        await EnsureCanManageAsync(id, cancellationToken);
        var restaurant = await FindAsync(id, cancellationToken);
        Apply(restaurant, request);
        await db.SaveChangesAsync(cancellationToken);
        return ToDto(restaurant);
    }

    public async Task<RestaurantDto> UpdateSettingsAsync(RestaurantSettingsDto request, CancellationToken cancellationToken = default)
    {
        var restaurant = await FindAsync(await scope.GetRestaurantIdAsync(cancellationToken), cancellationToken);
        restaurant.Settings = new RestaurantSettings
        {
            QrOrderingEnabled = request.QrOrderingEnabled,
            AutoConfirmQrOrders = request.AutoConfirmQrOrders,
            QrMenuBaseUrl = string.IsNullOrWhiteSpace(request.QrMenuBaseUrl) ? null : request.QrMenuBaseUrl.Trim().TrimEnd('/'),
            DefaultPreparationMinutes = request.DefaultPreparationMinutes,
            NewOrderSound = request.NewOrderSound,
            LowStockAlerts = request.LowStockAlerts,
            ReservationAlerts = request.ReservationAlerts,
            EnabledPaymentMethods = request.EnabledPaymentMethods.Distinct().ToList(),
        };
        await db.SaveChangesAsync(cancellationToken);
        return ToDto(restaurant);
    }

    public async Task DeactivateAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var restaurant = await FindAsync(id, cancellationToken);
        // Soft delete: orders, payments and reports must keep their history.
        restaurant.IsActive = false;
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsureCanManageAsync(Guid id, CancellationToken cancellationToken)
    {
        if (currentUser.IsInRole(Domain.Constants.Roles.SuperAdmin)) return;
        if (await scope.GetRestaurantIdAsync(cancellationToken) != id) throw new ForbiddenException();
    }

    private async Task<Restaurant> FindAsync(Guid id, CancellationToken cancellationToken) =>
        await db.Restaurants.FirstOrDefaultAsync(r => r.Id == id, cancellationToken)
        ?? throw new NotFoundException("Restaurant", id);

    private async Task<string> UniqueSlugAsync(string name, Guid? excludeId, CancellationToken cancellationToken)
    {
        var baseSlug = Regex.Replace(name.ToLowerInvariant(), "[^a-z0-9]+", "-").Trim('-');
        if (baseSlug.Length == 0) baseSlug = "restaurant";
        var slug = baseSlug;
        for (var i = 2; await db.Restaurants.AnyAsync(r => r.Slug == slug && r.Id != excludeId, cancellationToken); i++)
            slug = $"{baseSlug}-{i}";
        return slug;
    }

    private static void Apply(Restaurant r, SaveRestaurantRequest request)
    {
        r.Name = request.Name.Trim();
        r.LogoUrl = string.IsNullOrWhiteSpace(request.LogoUrl) ? null : request.LogoUrl.Trim();
        r.CoverImageUrl = string.IsNullOrWhiteSpace(request.CoverImageUrl) ? null : request.CoverImageUrl.Trim();
        r.Phone = request.Phone;
        r.Email = request.Email;
        r.Address = request.Address;
        r.Description = request.Description;
        r.OpeningTime = TimeOnly.Parse(request.OpeningTime);
        r.ClosingTime = TimeOnly.Parse(request.ClosingTime);
        r.Currency = request.Currency.ToUpperInvariant();
        r.TaxRate = request.TaxRate;
    }

    public static RestaurantDto ToDto(Restaurant r) => new(
        r.Id, r.Name, r.Slug, r.LogoUrl, r.CoverImageUrl, r.Phone, r.Email, r.Address, r.Description,
        r.OpeningTime.ToString("HH:mm"), r.ClosingTime.ToString("HH:mm"), r.Currency, r.TaxRate, r.IsActive,
        new RestaurantSettingsDto(
            r.Settings.QrOrderingEnabled, r.Settings.AutoConfirmQrOrders, r.Settings.QrMenuBaseUrl,
            r.Settings.DefaultPreparationMinutes, r.Settings.NewOrderSound, r.Settings.LowStockAlerts,
            r.Settings.ReservationAlerts, r.Settings.EnabledPaymentMethods));
}

public class SaveRestaurantRequestValidator : AbstractValidator<SaveRestaurantRequest>
{
    public SaveRestaurantRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.LogoUrl).MaximumLength(500).Must(BeHttpUrl!).When(x => !string.IsNullOrWhiteSpace(x.LogoUrl))
            .WithMessage("Logo URL must be an absolute http(s) URL.");
        RuleFor(x => x.CoverImageUrl).MaximumLength(500).Must(BeHttpUrl!).When(x => !string.IsNullOrWhiteSpace(x.CoverImageUrl))
            .WithMessage("Cover image URL must be an absolute http(s) URL.");
        RuleFor(x => x.Phone).MaximumLength(30);
        RuleFor(x => x.Email).EmailAddress().MaximumLength(150).When(x => !string.IsNullOrEmpty(x.Email));
        RuleFor(x => x.Address).MaximumLength(300);
        RuleFor(x => x.Description).MaximumLength(1000);
        RuleFor(x => x.OpeningTime).Must(BeTime).WithMessage("Opening time must be HH:mm.");
        RuleFor(x => x.ClosingTime).Must(BeTime).WithMessage("Closing time must be HH:mm.");
        RuleFor(x => x.Currency).NotEmpty().Length(3);
        RuleFor(x => x.TaxRate).InclusiveBetween(0, 100);
    }

    private static bool BeTime(string value) => TimeOnly.TryParse(value, out _);

    private static bool BeHttpUrl(string url) =>
        Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
}

public class RestaurantSettingsDtoValidator : AbstractValidator<RestaurantSettingsDto>
{
    public RestaurantSettingsDtoValidator()
    {
        RuleFor(x => x.DefaultPreparationMinutes).InclusiveBetween(1, 240);
        RuleFor(x => x.QrMenuBaseUrl).MaximumLength(300)
            .Must(u => Uri.TryCreate(u, UriKind.Absolute, out var uri) && (uri.Scheme == "http" || uri.Scheme == "https"))
            .When(x => !string.IsNullOrWhiteSpace(x.QrMenuBaseUrl))
            .WithMessage("QR base URL must be an absolute http(s) URL.");
        RuleFor(x => x.EnabledPaymentMethods).NotEmpty().WithMessage("Enable at least one payment method.");
    }
}
