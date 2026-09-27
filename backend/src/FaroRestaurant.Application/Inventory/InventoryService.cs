using FaroRestaurant.Application.Common.Exceptions;
using FaroRestaurant.Application.Common.Interfaces;
using FaroRestaurant.Application.Notifications;
using FaroRestaurant.Domain.Entities;
using FaroRestaurant.Domain.Enums;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaroRestaurant.Application.Inventory;

public sealed record InventoryItemDto(
    Guid Id,
    string Name,
    string Unit,
    decimal Quantity,
    decimal MinimumQuantity,
    string? Supplier,
    decimal PurchasePrice,
    decimal? SellingPrice,
    bool IsLowStock,
    decimal StockValue,
    DateTime? UpdatedAt);

public sealed record InventoryTransactionDto(
    Guid Id,
    InventoryTransactionType Type,
    decimal QuantityChange,
    decimal QuantityAfter,
    string? Note,
    DateTime CreatedAt);

public sealed record SaveInventoryItemRequest(
    string Name, string Unit, decimal Quantity, decimal MinimumQuantity, string? Supplier, decimal PurchasePrice, decimal? SellingPrice);

/// <summary>StockIn/StockOut take a positive amount; Adjustment sets the counted quantity.</summary>
public sealed record StockMovementRequest(InventoryTransactionType Type, decimal Quantity, string? Note);

public interface IInventoryService
{
    Task<IReadOnlyList<InventoryItemDto>> ListAsync(string? search, bool lowStockOnly, CancellationToken cancellationToken = default);
    Task<InventoryItemDto> CreateAsync(SaveInventoryItemRequest request, CancellationToken cancellationToken = default);
    Task<InventoryItemDto> UpdateAsync(Guid id, SaveInventoryItemRequest request, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
    Task<InventoryItemDto> MoveStockAsync(Guid id, StockMovementRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<InventoryTransactionDto>> GetTransactionsAsync(Guid id, CancellationToken cancellationToken = default);
}

public class InventoryService(
    IAppDbContext db,
    IRestaurantScope scope,
    ICurrentUser currentUser,
    INotificationService notifications) : IInventoryService
{
    public async Task<IReadOnlyList<InventoryItemDto>> ListAsync(string? search, bool lowStockOnly, CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        var query = db.InventoryItems.AsNoTracking().Where(i => i.RestaurantId == restaurantId);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(i => i.Name.ToLower().Contains(term) || (i.Supplier ?? "").ToLower().Contains(term));
        }
        if (lowStockOnly) query = query.Where(i => i.Quantity <= i.MinimumQuantity);

        var items = await query.OrderBy(i => i.Name).ToListAsync(cancellationToken);
        return items.Select(ToDto).ToList();
    }

    public async Task<InventoryItemDto> CreateAsync(SaveInventoryItemRequest request, CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        var item = new InventoryItem { RestaurantId = restaurantId };
        Apply(item, request);
        item.Quantity = request.Quantity;
        item.Transactions.Add(new InventoryTransaction
        {
            Type = InventoryTransactionType.StockIn,
            QuantityChange = request.Quantity,
            QuantityAfter = request.Quantity,
            Note = "Opening stock",
            CreatedByUserId = currentUser.UserId,
        });
        db.InventoryItems.Add(item);
        await db.SaveChangesAsync(cancellationToken);
        await AlertIfLowAsync(item, wasLow: false, cancellationToken);
        return ToDto(item);
    }

    public async Task<InventoryItemDto> UpdateAsync(Guid id, SaveInventoryItemRequest request, CancellationToken cancellationToken = default)
    {
        var item = await FindAsync(id, cancellationToken);
        var wasLow = item.IsLowStock;
        Apply(item, request);

        // Editing the quantity directly is recorded as an adjustment so the history stays accurate.
        if (request.Quantity != item.Quantity)
            Record(item, InventoryTransactionType.Adjustment, request.Quantity - item.Quantity, "Edited quantity");

        await db.SaveChangesAsync(cancellationToken);
        await AlertIfLowAsync(item, wasLow, cancellationToken);
        return ToDto(item);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        db.InventoryItems.Remove(await FindAsync(id, cancellationToken));
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<InventoryItemDto> MoveStockAsync(Guid id, StockMovementRequest request, CancellationToken cancellationToken = default)
    {
        var item = await FindAsync(id, cancellationToken);
        var wasLow = item.IsLowStock;

        var change = request.Type switch
        {
            InventoryTransactionType.StockIn => request.Quantity,
            InventoryTransactionType.StockOut => -request.Quantity,
            _ => request.Quantity - item.Quantity,
        };
        if (item.Quantity + change < 0)
            throw new ConflictException($"Only {item.Quantity:0.##} {item.Unit} of {item.Name} in stock.");

        Record(item, request.Type, change, request.Note);
        await db.SaveChangesAsync(cancellationToken);
        await AlertIfLowAsync(item, wasLow, cancellationToken);
        return ToDto(item);
    }

    public async Task<IReadOnlyList<InventoryTransactionDto>> GetTransactionsAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var item = await FindAsync(id, cancellationToken);
        return await db.InventoryTransactions.AsNoTracking()
            .Where(t => t.InventoryItemId == item.Id)
            .OrderByDescending(t => t.CreatedAt).Take(100)
            .Select(t => new InventoryTransactionDto(t.Id, t.Type, t.QuantityChange, t.QuantityAfter, t.Note, t.CreatedAt))
            .ToListAsync(cancellationToken);
    }

    private void Record(InventoryItem item, InventoryTransactionType type, decimal change, string? note)
    {
        item.Quantity += change;
        db.InventoryTransactions.Add(new InventoryTransaction
        {
            InventoryItemId = item.Id,
            Type = type,
            QuantityChange = change,
            QuantityAfter = item.Quantity,
            Note = note,
            CreatedByUserId = currentUser.UserId,
        });
    }

    /// <summary>Raises a LOW STOCK notification when an item crosses its minimum.</summary>
    private async Task AlertIfLowAsync(InventoryItem item, bool wasLow, CancellationToken cancellationToken)
    {
        if (wasLow || !item.IsLowStock) return;
        var restaurant = await db.Restaurants.AsNoTracking().FirstAsync(r => r.Id == item.RestaurantId, cancellationToken);
        if (!restaurant.Settings.LowStockAlerts) return;

        await notifications.PublishAsync(item.RestaurantId, NotificationType.LowStock,
            $"Low stock · {item.Name}",
            $"Remaining: {item.Quantity:0.##} {item.Unit} · Minimum: {item.MinimumQuantity:0.##} {item.Unit}",
            "/inventory", cancellationToken);
    }

    private async Task<InventoryItem> FindAsync(Guid id, CancellationToken cancellationToken)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        return await db.InventoryItems.FirstOrDefaultAsync(i => i.Id == id && i.RestaurantId == restaurantId, cancellationToken)
               ?? throw new NotFoundException("Inventory item", id);
    }

    private static void Apply(InventoryItem item, SaveInventoryItemRequest request)
    {
        item.Name = request.Name.Trim();
        item.Unit = request.Unit.Trim();
        item.MinimumQuantity = request.MinimumQuantity;
        item.Supplier = string.IsNullOrWhiteSpace(request.Supplier) ? null : request.Supplier.Trim();
        item.PurchasePrice = request.PurchasePrice;
        item.SellingPrice = request.SellingPrice;
    }

    private static InventoryItemDto ToDto(InventoryItem i) => new(
        i.Id, i.Name, i.Unit, i.Quantity, i.MinimumQuantity, i.Supplier, i.PurchasePrice, i.SellingPrice,
        i.IsLowStock, Math.Round(i.Quantity * i.PurchasePrice, 2), i.UpdatedAt ?? i.CreatedAt);
}

public class SaveInventoryItemRequestValidator : AbstractValidator<SaveInventoryItemRequest>
{
    public SaveInventoryItemRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(120);
        RuleFor(x => x.Unit).NotEmpty().MaximumLength(20);
        RuleFor(x => x.Quantity).GreaterThanOrEqualTo(0);
        RuleFor(x => x.MinimumQuantity).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Supplier).MaximumLength(150);
        RuleFor(x => x.PurchasePrice).GreaterThanOrEqualTo(0);
        RuleFor(x => x.SellingPrice).GreaterThanOrEqualTo(0).When(x => x.SellingPrice.HasValue);
    }
}

public class StockMovementRequestValidator : AbstractValidator<StockMovementRequest>
{
    public StockMovementRequestValidator()
    {
        RuleFor(x => x.Type).IsInEnum();
        RuleFor(x => x.Quantity).GreaterThan(0).When(x => x.Type != InventoryTransactionType.Adjustment);
        RuleFor(x => x.Quantity).GreaterThanOrEqualTo(0).When(x => x.Type == InventoryTransactionType.Adjustment);
        RuleFor(x => x.Note).MaximumLength(200);
    }
}
