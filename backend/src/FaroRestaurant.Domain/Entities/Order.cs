using FaroRestaurant.Domain.Common;
using FaroRestaurant.Domain.Enums;

namespace FaroRestaurant.Domain.Entities;

public class Order : RestaurantEntity
{
    /// <summary>Human-friendly sequential number shown as "#1045".</summary>
    public int Number { get; set; }

    public Guid? TableId { get; set; }
    public DiningTable? Table { get; set; }

    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    /// <summary>Walk-in / QR customer name when no customer record exists.</summary>
    public string? CustomerName { get; set; }

    public OrderSource Source { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Pending;

    public decimal Subtotal { get; set; }
    public decimal Discount { get; set; }
    public decimal TaxRate { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal Total { get; set; }

    public string? Notes { get; set; }
    public Guid? CreatedByUserId { get; set; }

    public DateTime? CompletedAt { get; set; }

    public ICollection<OrderItem> Items { get; set; } = [];
    public ICollection<Payment> Payments { get; set; } = [];

    /// <summary>Recalculates money fields from the items (tax applied after discount).</summary>
    public void RecalculateTotals()
    {
        Subtotal = Items.Sum(i => i.LineTotal);
        if (Discount > Subtotal) Discount = Subtotal;
        TaxAmount = Math.Round((Subtotal - Discount) * TaxRate / 100m, 2, MidpointRounding.AwayFromZero);
        Total = Subtotal - Discount + TaxAmount;
    }
}

public class OrderItem : BaseEntity
{
    public Guid OrderId { get; set; }
    public Order? Order { get; set; }

    public Guid? ProductId { get; set; }
    public Product? Product { get; set; }

    /// <summary>Snapshot of the product name/price at order time, so later menu edits don't rewrite history.</summary>
    public string ProductName { get; set; } = string.Empty;
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
    public string? Notes { get; set; }

    public decimal LineTotal => UnitPrice * Quantity;
}
