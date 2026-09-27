namespace FaroRestaurant.Application.Common.Interfaces;

/// <summary>
/// Time source. All timestamps are stored in UTC; "today" and report days are computed
/// in the restaurant's local time zone.
/// </summary>
public interface IClock
{
    DateTime UtcNow { get; }
    TimeZoneInfo TimeZone { get; }
    DateOnly Today { get; }

    /// <summary>UTC start (inclusive) of the given local date.</summary>
    DateTime StartOfDayUtc(DateOnly localDate);

    DateTime ToLocal(DateTime utc);
}
