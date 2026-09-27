using FaroRestaurant.Application.Common.Exceptions;
using FaroRestaurant.Application.Common.Interfaces;
using FaroRestaurant.Domain.Entities;
using FaroRestaurant.Domain.Enums;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaroRestaurant.Application.Tables;

public sealed record TableDto(
    Guid Id,
    int Number,
    string Name,
    int Capacity,
    string? Location,
    TableStatus Status,
    int ActiveOrders,
    decimal OpenAmount);

public sealed record SaveTableRequest(int Number, int Capacity, string? Location, TableStatus Status);

public sealed record UpdateTableStatusRequest(TableStatus Status);

public interface ITableService
{
    Task<IReadOnlyList<TableDto>> ListAsync(CancellationToken cancellationToken = default);
    Task<TableDto> GetAsync(Guid id, CancellationToken cancellationToken = default);
    Task<TableDto> CreateAsync(SaveTableRequest request, CancellationToken cancellationToken = default);
    Task<TableDto> UpdateAsync(Guid id, SaveTableRequest request, CancellationToken cancellationToken = default);
    Task<TableDto> UpdateStatusAsync(Guid id, TableStatus status, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}

public class TableService(IAppDbContext db, IRestaurantScope scope, IRealtimeNotifier realtime) : ITableService
{
    private static readonly OrderStatus[] ClosedStatuses = [OrderStatus.Completed, OrderStatus.Cancelled];

    public async Task<IReadOnlyList<TableDto>> ListAsync(CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        return await Project(db.Tables.Where(t => t.RestaurantId == restaurantId).OrderBy(t => t.Number))
            .ToListAsync(cancellationToken);
    }

    public async Task<TableDto> GetAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        return await Project(db.Tables.Where(t => t.Id == id && t.RestaurantId == restaurantId))
                   .FirstOrDefaultAsync(cancellationToken)
               ?? throw new NotFoundException("Table", id);
    }

    public async Task<TableDto> CreateAsync(SaveTableRequest request, CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        await EnsureUniqueNumberAsync(restaurantId, request.Number, null, cancellationToken);

        var table = new DiningTable { RestaurantId = restaurantId };
        Apply(table, request);
        db.Tables.Add(table);
        await db.SaveChangesAsync(cancellationToken);
        await realtime.TablesChangedAsync(restaurantId, cancellationToken);
        return await GetAsync(table.Id, cancellationToken);
    }

    public async Task<TableDto> UpdateAsync(Guid id, SaveTableRequest request, CancellationToken cancellationToken = default)
    {
        var table = await FindAsync(id, cancellationToken);
        await EnsureUniqueNumberAsync(table.RestaurantId, request.Number, id, cancellationToken);
        Apply(table, request);
        await db.SaveChangesAsync(cancellationToken);
        await realtime.TablesChangedAsync(table.RestaurantId, cancellationToken);
        return await GetAsync(id, cancellationToken);
    }

    public async Task<TableDto> UpdateStatusAsync(Guid id, TableStatus status, CancellationToken cancellationToken = default)
    {
        var table = await FindAsync(id, cancellationToken);
        table.Status = status;
        await db.SaveChangesAsync(cancellationToken);
        await realtime.TablesChangedAsync(table.RestaurantId, cancellationToken);
        return await GetAsync(id, cancellationToken);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var table = await FindAsync(id, cancellationToken);
        if (await db.Orders.AnyAsync(o => o.TableId == id && !ClosedStatuses.Contains(o.Status), cancellationToken))
            throw new ConflictException("This table has open orders. Close them before deleting the table.");

        db.Tables.Remove(table); // order history keeps its rows; TableId is set to null
        await db.SaveChangesAsync(cancellationToken);
        await realtime.TablesChangedAsync(table.RestaurantId, cancellationToken);
    }

    private async Task<DiningTable> FindAsync(Guid id, CancellationToken cancellationToken)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        return await db.Tables.FirstOrDefaultAsync(t => t.Id == id && t.RestaurantId == restaurantId, cancellationToken)
               ?? throw new NotFoundException("Table", id);
    }

    private async Task EnsureUniqueNumberAsync(Guid restaurantId, int number, Guid? excludeId, CancellationToken cancellationToken)
    {
        if (await db.Tables.AnyAsync(t => t.RestaurantId == restaurantId && t.Number == number && t.Id != excludeId, cancellationToken))
            throw new ConflictException($"{DiningTable.NamePrefix} {number:00} already exists.");
    }

    private static void Apply(DiningTable table, SaveTableRequest request)
    {
        table.Number = request.Number;
        table.Capacity = request.Capacity;
        table.Location = string.IsNullOrWhiteSpace(request.Location) ? null : request.Location.Trim();
        table.Status = request.Status;
    }

    private static IQueryable<TableDto> Project(IQueryable<DiningTable> query) =>
        query.Select(t => new TableDto(
            t.Id,
            t.Number,
            DiningTable.NamePrefix + " " + (t.Number < 10 ? "0" : "") + t.Number.ToString(),
            t.Capacity,
            t.Location,
            t.Status,
            t.Orders.Count(o => !ClosedStatuses.Contains(o.Status)),
            // Still to be paid on this masa (paid orders no longer count — the masa is free once the bill is settled).
            t.Orders.Where(o => !ClosedStatuses.Contains(o.Status) && o.PaymentStatus != PaymentStatus.Paid).Sum(o => (decimal?)o.Total) ?? 0));
}

public class SaveTableRequestValidator : AbstractValidator<SaveTableRequest>
{
    public SaveTableRequestValidator()
    {
        RuleFor(x => x.Number).InclusiveBetween(1, 999);
        RuleFor(x => x.Capacity).InclusiveBetween(1, 50);
        RuleFor(x => x.Location).MaximumLength(100);
        RuleFor(x => x.Status).IsInEnum();
    }
}
