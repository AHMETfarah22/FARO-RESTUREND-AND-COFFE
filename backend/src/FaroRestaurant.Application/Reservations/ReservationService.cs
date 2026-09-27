using FaroRestaurant.Application.Common.Exceptions;
using FaroRestaurant.Application.Common.Interfaces;
using FaroRestaurant.Application.Notifications;
using FaroRestaurant.Domain.Entities;
using FaroRestaurant.Domain.Enums;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaroRestaurant.Application.Reservations;

public sealed record ReservationDto(
    Guid Id,
    Guid? CustomerId,
    string CustomerName,
    string Phone,
    string? Email,
    DateOnly Date,
    TimeOnly Time,
    int PartySize,
    Guid? TableId,
    string? TableName,
    ReservationStatus Status,
    string? Notes,
    DateTime CreatedAt);

public sealed record SaveReservationRequest(
    string CustomerName,
    string Phone,
    string? Email,
    DateOnly Date,
    string Time,
    int PartySize,
    Guid? TableId,
    ReservationStatus Status,
    string? Notes);

public sealed record UpdateReservationStatusRequest(ReservationStatus Status);

public interface IReservationService
{
    Task<IReadOnlyList<ReservationDto>> ListAsync(DateOnly? from, DateOnly? to, ReservationStatus? status, string? search, CancellationToken cancellationToken = default);
    Task<ReservationDto> GetAsync(Guid id, CancellationToken cancellationToken = default);
    Task<ReservationDto> CreateAsync(SaveReservationRequest request, CancellationToken cancellationToken = default);
    Task<ReservationDto> UpdateAsync(Guid id, SaveReservationRequest request, CancellationToken cancellationToken = default);
    Task<ReservationDto> UpdateStatusAsync(Guid id, ReservationStatus status, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}

public class ReservationService(
    IAppDbContext db,
    IRestaurantScope scope,
    INotificationService notifications,
    IRealtimeNotifier realtime) : IReservationService
{
    public async Task<IReadOnlyList<ReservationDto>> ListAsync(DateOnly? from, DateOnly? to, ReservationStatus? status, string? search, CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        var query = db.Reservations.AsNoTracking().Where(r => r.RestaurantId == restaurantId);
        if (from is { } f) query = query.Where(r => r.Date >= f);
        if (to is { } t) query = query.Where(r => r.Date <= t);
        if (status is { } s) query = query.Where(r => r.Status == s);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(r => r.CustomerName.ToLower().Contains(term) || r.Phone.ToLower().Contains(term));
        }

        return await Project(query.OrderBy(r => r.Date).ThenBy(r => r.Time).Take(500)).ToListAsync(cancellationToken);
    }

    public async Task<ReservationDto> GetAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        return await Project(db.Reservations.Where(r => r.Id == id && r.RestaurantId == restaurantId)).FirstOrDefaultAsync(cancellationToken)
               ?? throw new NotFoundException("Reservation", id);
    }

    public async Task<ReservationDto> CreateAsync(SaveReservationRequest request, CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        var reservation = new Reservation { RestaurantId = restaurantId };
        await ApplyAsync(reservation, request, cancellationToken);
        db.Reservations.Add(reservation);
        await db.SaveChangesAsync(cancellationToken);

        await notifications.PublishAsync(restaurantId, NotificationType.Reservation,
            $"New reservation · {reservation.CustomerName}",
            $"{reservation.Date:dd MMM} at {reservation.Time:HH\\:mm} · {reservation.PartySize} people",
            "/reservations", cancellationToken);

        return await GetAsync(reservation.Id, cancellationToken);
    }

    public async Task<ReservationDto> UpdateAsync(Guid id, SaveReservationRequest request, CancellationToken cancellationToken = default)
    {
        var reservation = await FindAsync(id, cancellationToken);
        await ApplyAsync(reservation, request, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return await GetAsync(id, cancellationToken);
    }

    public async Task<ReservationDto> UpdateStatusAsync(Guid id, ReservationStatus status, CancellationToken cancellationToken = default)
    {
        var reservation = await FindAsync(id, cancellationToken);
        reservation.Status = status;

        // Seat the guests: an arrived reservation occupies its table.
        if (status == ReservationStatus.Arrived && reservation.TableId is { } tableId)
        {
            var table = await db.Tables.FirstAsync(t => t.Id == tableId, cancellationToken);
            if (table.Status is TableStatus.Available or TableStatus.Reserved)
            {
                table.Status = TableStatus.Occupied;
                await db.SaveChangesAsync(cancellationToken);
                await realtime.TablesChangedAsync(reservation.RestaurantId, cancellationToken);
                return await GetAsync(id, cancellationToken);
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        return await GetAsync(id, cancellationToken);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        db.Reservations.Remove(await FindAsync(id, cancellationToken));
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task<Reservation> FindAsync(Guid id, CancellationToken cancellationToken)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        return await db.Reservations.FirstOrDefaultAsync(r => r.Id == id && r.RestaurantId == restaurantId, cancellationToken)
               ?? throw new NotFoundException("Reservation", id);
    }

    private async Task ApplyAsync(Reservation r, SaveReservationRequest request, CancellationToken cancellationToken)
    {
        if (request.TableId is { } tableId)
        {
            var table = await db.Tables.FirstOrDefaultAsync(t => t.Id == tableId && t.RestaurantId == r.RestaurantId, cancellationToken)
                        ?? throw new NotFoundException("Table", tableId);
            if (table.Capacity < request.PartySize)
                throw new ConflictException($"{table.DisplayName} seats {table.Capacity}; the party has {request.PartySize} people.");

            // A table is considered booked for 2 hours either side (clamped to the same day).
            var time = TimeOnly.Parse(request.Time);
            var lower = time.Hour >= 2 ? time.AddHours(-2) : TimeOnly.MinValue;
            var upper = time.Hour < 22 ? time.AddHours(2) : TimeOnly.MaxValue;
            var clash = await db.Reservations.AnyAsync(x =>
                x.RestaurantId == r.RestaurantId && x.Id != r.Id && x.TableId == tableId && x.Date == request.Date &&
                x.Status != ReservationStatus.Cancelled && x.Status != ReservationStatus.Completed &&
                x.Time > lower && x.Time < upper, cancellationToken);
            if (clash) throw new ConflictException($"{table.DisplayName} already has a reservation within 2 hours of {request.Time}.");
        }

        // Link to (or create) the customer record by phone so the customer history stays complete.
        var phone = request.Phone.Trim();
        var customer = await db.Customers.FirstOrDefaultAsync(c => c.RestaurantId == r.RestaurantId && c.Phone == phone, cancellationToken);
        if (customer is null)
        {
            customer = new Customer { RestaurantId = r.RestaurantId, Name = request.CustomerName.Trim(), Phone = phone, Email = request.Email };
            db.Customers.Add(customer);
        }

        r.Customer = customer;
        r.CustomerName = request.CustomerName.Trim();
        r.Phone = phone;
        r.Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();
        r.Date = request.Date;
        r.Time = TimeOnly.Parse(request.Time);
        r.PartySize = request.PartySize;
        r.TableId = request.TableId;
        r.Status = request.Status;
        r.Notes = request.Notes;
    }

    public static IQueryable<ReservationDto> Project(IQueryable<Reservation> query) =>
        query.Select(r => new ReservationDto(
            r.Id, r.CustomerId, r.CustomerName, r.Phone, r.Email, r.Date,
            r.Time,
            r.PartySize, r.TableId,
            r.Table == null ? null : DiningTable.NamePrefix + " " + (r.Table.Number < 10 ? "0" : "") + r.Table.Number.ToString(),
            r.Status, r.Notes, r.CreatedAt));
}

public class SaveReservationRequestValidator : AbstractValidator<SaveReservationRequest>
{
    public SaveReservationRequestValidator()
    {
        RuleFor(x => x.CustomerName).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Phone).NotEmpty().MaximumLength(30).Matches(@"^[0-9 +()-]+$").WithMessage("Phone number contains invalid characters.");
        RuleFor(x => x.Email).EmailAddress().MaximumLength(150).When(x => !string.IsNullOrEmpty(x.Email));
        RuleFor(x => x.Time).Must(t => TimeOnly.TryParse(t, out _)).WithMessage("Time must be HH:mm.");
        RuleFor(x => x.PartySize).InclusiveBetween(1, 50);
        RuleFor(x => x.Status).IsInEnum();
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}
