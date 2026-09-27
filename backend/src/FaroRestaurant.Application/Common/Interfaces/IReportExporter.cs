namespace FaroRestaurant.Application.Common.Interfaces;

public enum ExportFormat { Csv, Xlsx, Pdf }

/// <summary>A simple table (title + headers + rows) that any exporter can render.</summary>
public sealed record TabularReport(string Title, string Subtitle, IReadOnlyList<string> Headers, IReadOnlyList<IReadOnlyList<string>> Rows);

public sealed record ExportedFile(byte[] Content, string ContentType, string FileName);

public interface IReportExporter
{
    ExportedFile Export(TabularReport report, ExportFormat format);
}
