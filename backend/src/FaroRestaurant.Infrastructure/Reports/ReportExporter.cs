using System.Text;
using ClosedXML.Excel;
using FaroRestaurant.Application.Common.Interfaces;
using FaroRestaurant.Domain.Constants;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace FaroRestaurant.Infrastructure.Reports;

/// <summary>Renders a tabular report as CSV, Excel (.xlsx) or PDF in the black/white brand style.</summary>
public class ReportExporter : IReportExporter
{
    static ReportExporter()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public ExportedFile Export(TabularReport report, ExportFormat format)
    {
        var baseName = $"{Slug(report.Title)}-{DateTime.UtcNow:yyyyMMdd-HHmm}";
        return format switch
        {
            ExportFormat.Csv => new ExportedFile(ToCsv(report), "text/csv; charset=utf-8", baseName + ".csv"),
            ExportFormat.Xlsx => new ExportedFile(ToXlsx(report),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", baseName + ".xlsx"),
            _ => new ExportedFile(ToPdf(report), "application/pdf", baseName + ".pdf"),
        };
    }

    private static byte[] ToCsv(TabularReport report)
    {
        static string Escape(string v) => v.IndexOfAny([',', '"', '\n', '\r', ';']) >= 0 ? $"\"{v.Replace("\"", "\"\"")}\"" : v;

        var sb = new StringBuilder();
        sb.AppendLine(string.Join(',', report.Headers.Select(Escape)));
        foreach (var row in report.Rows) sb.AppendLine(string.Join(',', row.Select(Escape)));

        // BOM so Excel opens UTF-8 (₺, ç, ş, ğ …) correctly.
        return [.. Encoding.UTF8.GetPreamble(), .. Encoding.UTF8.GetBytes(sb.ToString())];
    }

    private static byte[] ToXlsx(TabularReport report)
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add(report.Title.Length > 31 ? report.Title[..31] : report.Title);

        sheet.Cell(1, 1).Value = Brand.Name;
        sheet.Cell(1, 1).Style.Font.SetBold().Font.SetFontSize(14);
        sheet.Cell(2, 1).Value = report.Title;
        sheet.Cell(2, 1).Style.Font.SetBold();
        sheet.Cell(3, 1).Value = report.Subtitle;
        sheet.Cell(3, 1).Style.Font.SetFontColor(XLColor.Gray);

        const int headerRow = 5;
        for (var c = 0; c < report.Headers.Count; c++)
        {
            var cell = sheet.Cell(headerRow, c + 1);
            cell.Value = report.Headers[c];
            cell.Style.Font.SetBold().Font.SetFontColor(XLColor.White).Fill.SetBackgroundColor(XLColor.Black);
        }

        for (var r = 0; r < report.Rows.Count; r++)
        for (var c = 0; c < report.Rows[r].Count; c++)
        {
            var raw = report.Rows[r][c];
            var cell = sheet.Cell(headerRow + 1 + r, c + 1);
            if (decimal.TryParse(raw, System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var number))
                cell.Value = number;
            else
                cell.Value = raw;
        }

        sheet.Columns().AdjustToContents();
        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    private static byte[] ToPdf(TabularReport report) =>
        Document.Create(container => container.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(36);
            page.DefaultTextStyle(t => t.FontSize(10).FontColor("#111111"));

            page.Header().PaddingBottom(16).Column(col =>
            {
                col.Item().Text("FARO").FontSize(22).SemiBold().LetterSpacing(0.2f);
                col.Item().Text("RESTURENT AND COFFE").FontSize(8).LetterSpacing(0.4f).FontColor("#666666");
                col.Item().PaddingTop(12).Text(report.Title).FontSize(14).SemiBold();
                col.Item().Text(report.Subtitle).FontColor("#666666");
            });

            page.Content().Table(table =>
            {
                table.ColumnsDefinition(cols =>
                {
                    for (var i = 0; i < report.Headers.Count; i++)
                        if (i == 0) cols.RelativeColumn(2); else cols.RelativeColumn();
                });

                table.Header(header =>
                {
                    foreach (var h in report.Headers)
                        header.Cell().Background("#111111").PaddingVertical(6).PaddingHorizontal(8)
                            .Text(h).FontColor("#FFFFFF").SemiBold();
                });

                var index = 0;
                foreach (var row in report.Rows)
                {
                    var background = index++ % 2 == 0 ? "#FFFFFF" : "#F5F5F5";
                    foreach (var value in row)
                        table.Cell().Background(background).BorderBottom(0.5f).BorderColor("#E5E5E5")
                            .PaddingVertical(5).PaddingHorizontal(8).Text(value);
                }
            });

            page.Footer().AlignCenter().Text(t =>
            {
                t.Span($"{Brand.Name} · Generated {DateTime.Now:dd.MM.yyyy HH:mm} · Page ").FontColor("#666666").FontSize(8);
                t.CurrentPageNumber().FontSize(8);
            });
        })).GeneratePdf();

    private static string Slug(string value) =>
        new string(value.ToLowerInvariant().Select(ch => char.IsLetterOrDigit(ch) ? ch : '-').ToArray()).Trim('-');
}
