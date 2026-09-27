using FaroRestaurant.Domain.Enums;

namespace FaroRestaurant.Application.Common.Interfaces;

public sealed record PaymentRequest(Guid OrderId, int OrderNumber, decimal Amount, string Currency, PaymentMethod Method, bool SimulateFailure);

public sealed record PaymentResult(bool Success, string Provider, string? TransactionReference, string? FailureReason);

/// <summary>
/// Payment provider abstraction. The test build uses a simulated gateway; Stripe, Iyzico, etc.
/// can be added later as further implementations without touching business logic.
/// </summary>
public interface IPaymentGateway
{
    Task<PaymentResult> ChargeAsync(PaymentRequest request, CancellationToken cancellationToken = default);
    Task<PaymentResult> RefundAsync(string? transactionReference, decimal amount, CancellationToken cancellationToken = default);
}
