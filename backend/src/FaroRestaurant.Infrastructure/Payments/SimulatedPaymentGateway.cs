using FaroRestaurant.Application.Common.Interfaces;

namespace FaroRestaurant.Infrastructure.Payments;

/// <summary>
/// Test-only gateway: never contacts a real provider. Every payment succeeds unless the cashier
/// ticks "simulate failure". Replace with a Stripe/Iyzico implementation of IPaymentGateway for production.
/// </summary>
public class SimulatedPaymentGateway : IPaymentGateway
{
    private const string Provider = "Simulated";

    public async Task<PaymentResult> ChargeAsync(PaymentRequest request, CancellationToken cancellationToken = default)
    {
        await Task.Delay(300, cancellationToken); // feel of a real network call

        if (request.SimulateFailure)
            return new PaymentResult(false, Provider, null, "Card declined (simulated failure).");

        var prefix = request.Method.ToString().ToUpperInvariant()[..3];
        return new PaymentResult(true, Provider, $"SIM-{prefix}-{request.OrderNumber}-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}", null);
    }

    public Task<PaymentResult> RefundAsync(string? transactionReference, decimal amount, CancellationToken cancellationToken = default) =>
        Task.FromResult(new PaymentResult(true, Provider, transactionReference, null));
}
