using FaroRestaurant.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;

namespace FaroRestaurant.Infrastructure.Services;

/// <summary>Restaurant-local calendar based on App:TimeZone (default Europe/Istanbul).</summary>
public class Clock : IClock
{
    public Clock(IConfiguration configuration)
    {
        var id = configuration["App:TimeZone"] ?? "Europe/Istanbul";
        TimeZone = TimeZoneInfo.TryFindSystemTimeZoneById(id, out var tz) ? tz : TimeZoneInfo.Utc;
    }

    public DateTime UtcNow => DateTime.UtcNow;
    public TimeZoneInfo TimeZone { get; }
    public DateOnly Today => DateOnly.FromDateTime(ToLocal(UtcNow));

    public DateTime StartOfDayUtc(DateOnly localDate) =>
        TimeZoneInfo.ConvertTimeToUtc(localDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), TimeZone);

    public DateTime ToLocal(DateTime utc) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), TimeZone);
}
