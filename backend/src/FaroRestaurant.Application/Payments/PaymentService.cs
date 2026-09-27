using FaroRestaurant.Application.Common.Exceptions;
using FaroRestaurant.Application.Common.Interfaces;
using FaroRestaurant.Application.Common.Models;
using FaroRestaurant.Application.Notifications;
using FaroRestaurant.Application.Orders;
using FaroRestaurant.Domain.Entities;
using FaroRestaurant.Domain.Enums;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace FaroRestaurant.Application.Payments;

public sealed record PaymentDto(
    Guid Id,
    Guid OrderId,
    int OrderNumber,
    string? TableName,
    decimal Amount,
    PaymentMethod Method,
    PaymentStatus Status,
    string Provider,
    string? TransactionReference,
    string? FailureReason,
    DateTime CreatedAt,
    DateTime? PaidAt,
    DateTime? RefundedAt);

/// <summary>Amount defaults to the order's outstanding balance. SimulateFailure lets testers exercise the failure path.</summary>
public sealed record CreatePaymentRequest(Guid OrderId, PaymentMethod Method, decimal? Amount, bool SimulateFailure, bool CompleteOrder);

public sealed record PaymentQuery(DateOnly? From, DateOnly? To, PaymentStatus? Status, PaymentMethod? Method, int Page = 1, int PageSize = 20);

public sealed record PaymentSummaryDto(decimal PaidTotal, decimal RefundedTotal, int PaidCount, int FailedCount, IReadOnlyDictionary<PaymentMethod, decimal> ByMethod);

public sealed record PaymentResultDto(PaymentDto Payment, OrderDto Order);

public interface IPaymentService
{
    Task<PagedResult<PaymentDto>> ListAsync(PaymentQuery query, CancellationToken cancellationToken = default);
    Task<PaymentSummaryDto> SummaryAsync(DateOnly? from, DateOnly? to, CancellationToken cancellationToken = default);
    Task<PaymentResultDto> PayAsync(CreatePaymentRequest request, CancellationToken cancellationToken = default);
    Task<PaymentResultDto> RefundAsync(Guid paymentId, CancellationToken cancellationToken = default);
}

public class PaymentService(
    IAppDbContext db,
    IRestaurantScope scope,
    ICurrentUser currentUser,
    IClock clock,
    IPaymentGateway gateway,
    IOrderService orders,
    IRealtimeNotifier realtime,
    INotificationService notifications) : IPaymentService
{
    public async Task<PagedResult<PaymentDto>> ListAsync(PaymentQuery query, CancellationToken cancellationToken = default)
    {
        var payments = await FilterAsync(query.From, query.To, cancellationToken);
        if (query.Status is { } status) payments = payments.Where(p => p.Status == status);
        if (query.Method is { } method) payments = payments.Where(p => p.Method == method);

        return await Project(payments.OrderByDescending(p => p.CreatedAt)).ToPagedAsync(query.Page, query.PageSize, cancellationToken);
    }

    public async Task<PaymentSummaryDto> SummaryAsync(DateOnly? from, DateOnly? to, CancellationToken cancellationToken = default)
    {
        var payments = await FilterAsync(from, to, cancellationToken);
        var rows = await payments.GroupBy(p => new { p.Status, p.Method })
            .Select(g => new { g.Key.Status, g.Key.Method, Total = g.Sum(p => p.Amount), Count = g.Count() })
            .ToListAsync(cancellationToken);

        var paid = rows.Where(r => r.Status == PaymentStatus.Paid).ToList();
        return new PaymentSummaryDto(
            paid.Sum(r => r.Total),
            rows.Where(r => r.Status == PaymentStatus.Refunded).Sum(r => r.Total),
            paid.Sum(r => r.Count),
            rows.Where(r => r.Status == PaymentStatus.Failed).Sum(r => r.Count),
            Enum.GetValues<PaymentMethod>().ToDictionary(m => m, m => paid.Where(r => r.Method == m).Sum(r => r.Total)));
    }

    public async Task<PaymentResultDto> PayAsync(CreatePaymentRequest request, CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        var order = await db.Orders.Include(o => o.Payments)
                        .FirstOrDefaultAsync(o => o.Id == request.OrderId && o.RestaurantId == restaurantId, cancellationToken)
                    ?? throw new NotFoundException("Order", request.OrderId);
        var restaurant = await db.Restaurants.AsNoTracking().FirstAsync(r => r.Id == restaurantId, cancellationToken);

        if (order.Status == OrderStatus.Cancelled) throw new ConflictException("A cancelled order cannot be paid.");
        if (!restaurant.Settings.EnabledPaymentMethods.Contains(request.Method))
            throw new ConflictException($"{request.Method} payments are disabled in settings.");

        var paidSoFar = order.Payments.Where(p => p.Status == PaymentStatus.Paid).Sum(p => p.Amount);
        var outstanding = order.Total - paidSoFar;
        if (outstanding <= 0) throw new ConflictException("This order is already fully paid.");

        var amount = request.Amount ?? outstanding;
        if (amount > outstanding) throw new ConflictException($"Amount exceeds the outstanding balance ({outstanding:0.00}).");

        var result = await gateway.ChargeAsync(
            new PaymentRequest(order.Id, order.Number, amount, restaurant.Currency, request.Method, request.SimulateFailure), cancellationToken);

        var payment = new Payment
        {
            RestaurantId = restaurantId,
            OrderId = order.Id,
            Amount = amount,
            Method = request.Method,
            Provider = result.Provider,
            TransactionReference = result.TransactionReference,
            Status = result.Success ? PaymentStatus.Paid : PaymentStatus.Failed,
            FailureReason = result.FailureReason,
            ProcessedByUserId = currentUser.UserId,
            PaidAt = result.Success ? clock.UtcNow : null,
        };
        order.Payments.Add(payment);

        if (result.Success && paidSoFar + amount >= order.Total) order.PaymentStatus = PaymentStatus.Paid;
        else if (!result.Success && paidSoFar == 0) order.PaymentStatus = PaymentStatus.Failed;

        await db.SaveChangesAsync(cancellationToken);

        OrderDto orderDto;
        if (result.Success && order.PaymentStatus == PaymentStatus.Paid && request.CompleteOrder &&
            order.Status is OrderStatus.Ready or OrderStatus.Served)
        {
            orderDto = await orders.UpdateStatusAsync(order.Id, OrderStatus.Completed, cancellationToken);
        }
        else
        {
            orderDto = await orders.GetAsync(order.Id, cancellationToken);
            await realtime.OrderUpdatedAsync(restaurantId, orderDto, cancellationToken);
        }

        // The masa is free the moment its bill is paid.
        if (result.Success && order.PaymentStatus == PaymentStatus.Paid)
            await orders.SettleTableAsync(order.Id, cancellationToken);

        await notifications.PublishAsync(restaurantId, NotificationType.Payment,
            result.Success ? $"Payment received · #{order.Number}" : $"Payment failed · #{order.Number}",
            result.Success ? $"{amount:0.00} {restaurant.Currency} by {request.Method}" : result.FailureReason ?? "Payment was declined.",
            $"/orders/{order.Id}", cancellationToken);

        return new PaymentResultDto(await GetDtoAsync(payment.Id, cancellationToken), orderDto);
    }

    public async Task<PaymentResultDto> RefundAsync(Guid paymentId, CancellationToken cancellationToken = default)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        var payment = await db.Payments.Include(p => p.Order).ThenInclude(o => o!.Payments)
                          .FirstOrDefaultAsync(p => p.Id == paymentId && p.RestaurantId == restaurantId, cancellationToken)
                      ?? throw new NotFoundException("Payment", paymentId);
        if (payment.Status != PaymentStatus.Paid) throw new ConflictException("Only paid payments can be refunded.");

        var result = await gateway.RefundAsync(payment.TransactionReference, payment.Amount, cancellationToken);
        if (!result.Success) throw new ConflictException(result.FailureReason ?? "Refund failed.");

        payment.Status = PaymentStatus.Refunded;
        payment.RefundedAt = clock.UtcNow;

        var order = payment.Order!;
        var stillPaid = order.Payments.Where(p => p.Status == PaymentStatus.Paid).Sum(p => p.Amount);
        order.PaymentStatus = stillPaid >= order.Total ? PaymentStatus.Paid : stillPaid > 0 ? PaymentStatus.Pending : PaymentStatus.Refunded;
        await db.SaveChangesAsync(cancellationToken);

        var orderDto = await orders.GetAsync(order.Id, cancellationToken);
        await realtime.OrderUpdatedAsync(restaurantId, orderDto, cancellationToken);
        return new PaymentResultDto(await GetDtoAsync(payment.Id, cancellationToken), orderDto);
    }

    private async Task<IQueryable<Payment>> FilterAsync(DateOnly? from, DateOnly? to, CancellationToken cancellationToken)
    {
        var restaurantId = await scope.GetRestaurantIdAsync(cancellationToken);
        var payments = db.Payments.AsNoTracking().Where(p => p.RestaurantId == restaurantId);
        if (from is { } f) payments = payments.Where(p => p.CreatedAt >= clock.StartOfDayUtc(f));
        if (to is { } t) payments = payments.Where(p => p.CreatedAt < clock.StartOfDayUtc(t.AddDays(1)));
        return payments;
    }

    private async Task<PaymentDto> GetDtoAsync(Guid id, CancellationToken cancellationToken) =>
        await Project(db.Payments.AsNoTracking().Where(p => p.Id == id)).FirstAsync(cancellationToken);

    private static IQueryable<PaymentDto> Project(IQueryable<Payment> query) =>
        query.Select(p => new PaymentDto(
            p.Id, p.OrderId, p.Order!.Number,
            p.Order.Table == null ? null : DiningTable.NamePrefix + " " + (p.Order.Table.Number < 10 ? "0" : "") + p.Order.Table.Number.ToString(),
            p.Amount, p.Method, p.Status, p.Provider, p.TransactionReference, p.FailureReason, p.CreatedAt, p.PaidAt, p.RefundedAt));
}

public class CreatePaymentRequestValidator : AbstractValidator<CreatePaymentRequest>
{
    public CreatePaymentRequestValidator()
    {
        RuleFor(x => x.OrderId).NotEmpty();
        RuleFor(x => x.Method).IsInEnum();
        RuleFor(x => x.Amount).GreaterThan(0).When(x => x.Amount.HasValue);
    }
}
