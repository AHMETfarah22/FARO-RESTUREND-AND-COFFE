using FaroRestaurant.Domain.Common;
using FaroRestaurant.Domain.Enums;

namespace FaroRestaurant.Domain.Entities;

/// <summary>A physical table. Its Id is embedded in the QR code URL (/menu/table/{id}).</summary>
public class DiningTable : RestaurantEntity
{
    public int Number { get; set; }
    public int Capacity { get; set; }
    public string? Location { get; set; }
    public TableStatus Status { get; set; } = TableStatus.Available;

    public ICollection<Order> Orders { get; set; } = [];

    /// <summary>Word shown before the table number ("Masa 01"). Used by every query that builds a table name.</summary>
    public const string NamePrefix = "Masa";

    public string DisplayName => $"{NamePrefix} {Number:00}";
}
