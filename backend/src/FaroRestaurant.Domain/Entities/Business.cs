using FaroRestaurant.Domain.Common;
using FaroRestaurant.Domain.Enums;

namespace FaroRestaurant.Domain.Entities;

public class Customer : RestaurantEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Notes { get; set; }

    /// <summary>Linked login account (Customer role), if the customer registered.</summary>
    public Guid? UserId { get; set; }

    public ICollection<Order> Orders { get; set; } = [];
    public ICollection<Reservation> Reservations { get; set; } = [];
}

public class Reservation : RestaurantEntity
{
    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public string CustomerName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public DateOnly Date { get; set; }
    public TimeOnly Time { get; set; }
    public int PartySize { get; set; }

    public Guid? TableId { get; set; }
    public DiningTable? Table { get; set; }

    public ReservationStatus Status { get; set; } = ReservationStatus.Pending;
    public string? Notes { get; set; }
}

/// <summary>Employee profile of a restaurant user (the RestaurantUsers link).</summary>
public class StaffMember : RestaurantEntity
{
    public Guid UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string Role { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateOnly HiredOn { get; set; }
}

public class InventoryItem : RestaurantEntity
{
    public string Name { get; set; } = string.Empty;
    public string Unit { get; set; } = "pcs";
    public decimal Quantity { get; set; }
    public decimal MinimumQuantity { get; set; }
    public string? Supplier { get; set; }
    public decimal PurchasePrice { get; set; }
    public decimal? SellingPrice { get; set; }

    public ICollection<InventoryTransaction> Transactions { get; set; } = [];

    public bool IsLowStock => Quantity <= MinimumQuantity;
}

public class InventoryTransaction : BaseEntity
{
    public Guid InventoryItemId { get; set; }
    public InventoryItem? InventoryItem { get; set; }
    public InventoryTransactionType Type { get; set; }

    /// <summary>Signed change applied to the stock quantity.</summary>
    public decimal QuantityChange { get; set; }
    public decimal QuantityAfter { get; set; }
    public string? Note { get; set; }
    public Guid? CreatedByUserId { get; set; }
}

public class Payment : RestaurantEntity
{
    public Guid OrderId { get; set; }
    public Order? Order { get; set; }
    public decimal Amount { get; set; }
    public PaymentMethod Method { get; set; }
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;

    /// <summary>Gateway name, e.g. "Simulated", later "Stripe" / "Iyzico".</summary>
    public string Provider { get; set; } = "Simulated";
    public string? TransactionReference { get; set; }
    public string? FailureReason { get; set; }
    public Guid? ProcessedByUserId { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime? RefundedAt { get; set; }
}

public class Notification : RestaurantEntity
{
    public NotificationType Type { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;

    /// <summary>Portal route to open, e.g. /orders/{id}.</summary>
    public string? Link { get; set; }
    public bool IsRead { get; set; }
}
