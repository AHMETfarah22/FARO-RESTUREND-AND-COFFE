using FaroRestaurant.Domain.Common;
using FaroRestaurant.Domain.Enums;

namespace FaroRestaurant.Domain.Entities;

/// <summary>
/// A restaurant (tenant). Every table, product, order, etc. belongs to one restaurant,
/// which keeps the system ready for multi-restaurant deployments.
/// </summary>
public class Restaurant : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }

    /// <summary>Wide photo used behind the logo on the QR menu, login page and dashboard.</summary>
    public string? CoverImageUrl { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? Description { get; set; }
    public TimeOnly OpeningTime { get; set; }
    public TimeOnly ClosingTime { get; set; }

    /// <summary>ISO 4217 currency code, e.g. "TRY".</summary>
    public string Currency { get; set; } = "TRY";

    /// <summary>Tax rate as a percentage, e.g. 10 = 10%.</summary>
    public decimal TaxRate { get; set; }

    public bool IsActive { get; set; } = true;

    public RestaurantSettings Settings { get; set; } = new();
}

/// <summary>Operational settings, stored as a JSON document on the restaurant row.</summary>
public class RestaurantSettings
{
    /// <summary>Customers may place orders from the QR menu (otherwise browse-only).</summary>
    public bool QrOrderingEnabled { get; set; } = true;

    /// <summary>QR orders skip "Pending" and go straight to "Confirmed".</summary>
    public bool AutoConfirmQrOrders { get; set; }

    /// <summary>Public base URL printed into QR codes, e.g. https://menu.example.com. Empty = portal origin.</summary>
    public string? QrMenuBaseUrl { get; set; }

    public int DefaultPreparationMinutes { get; set; } = 15;

    public bool NewOrderSound { get; set; } = true;
    public bool LowStockAlerts { get; set; } = true;
    public bool ReservationAlerts { get; set; } = true;

    public List<PaymentMethod> EnabledPaymentMethods { get; set; } =
        [PaymentMethod.Cash, PaymentMethod.Card, PaymentMethod.Online, PaymentMethod.Test];
}
