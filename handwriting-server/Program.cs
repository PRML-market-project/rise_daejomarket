using Windows.Foundation;
using Windows.UI.Input.Inking;

const string CorsPolicy = "Frontend";

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://127.0.0.1:17832");
builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicy, policy =>
        policy
            .WithOrigins(
                "http://localhost:5173",
                "http://127.0.0.1:5173")
            .AllowAnyHeader()
            .AllowAnyMethod());
});

var app = builder.Build();
app.UseCors(CorsPolicy);

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.MapGet("/recognizers", () =>
{
    var recognizers = new InkRecognizerContainer()
        .GetRecognizers()
        .Select(recognizer => recognizer.Name)
        .ToArray();

    return Results.Ok(new { recognizers });
});

app.MapPost("/recognize", async (RecognizeRequest request) =>
{
    var validStrokes = request.Strokes
        .Where(stroke => stroke.Points.Count >= 2)
        .ToArray();

    if (validStrokes.Length == 0)
    {
        return Results.BadRequest(new
        {
            error = "인식할 수 있는 필기 획이 없습니다.",
            candidates = Array.Empty<string>(),
        });
    }

    try
    {
        var strokeContainer = new InkStrokeContainer();

        foreach (var inputStroke in validStrokes)
        {
            var strokeBuilder = new InkStrokeBuilder();
            var points = inputStroke.Points
                .Select(point => new Point(point.X, point.Y))
                .ToArray();
            strokeContainer.AddStroke(strokeBuilder.CreateStroke(points));
        }

        var recognizerContainer = new InkRecognizerContainer();
        var installedRecognizers = recognizerContainer.GetRecognizers();
        var requestedRecognizer = FindRecognizer(installedRecognizers, request.Language);

        if (requestedRecognizer is not null)
        {
            recognizerContainer.SetDefaultRecognizer(requestedRecognizer);
        }

        var recognitionResults = await recognizerContainer.RecognizeAsync(
            strokeContainer,
            InkRecognitionTarget.All);

        var wordCandidates = recognitionResults
            .Select(result => result.GetTextCandidates().Take(8).ToArray())
            .Where(candidates => candidates.Length > 0)
            .ToArray();

        var candidates = Enumerable.Range(0, 8)
            .Select(rank => string.Join(
                " ",
                wordCandidates.Select(words =>
                    words.ElementAtOrDefault(rank) ?? words[0])))
            .Where(candidate => !string.IsNullOrWhiteSpace(candidate))
            .Distinct()
            .Take(8)
            .ToArray();

        return Results.Ok(new
        {
            candidates,
            recognizer = requestedRecognizer?.Name ??
                installedRecognizers.FirstOrDefault()?.Name,
        });
    }
    catch (Exception error)
    {
        return Results.Problem(
            title: "Windows Ink 필기 인식에 실패했습니다.",
            detail: error.Message,
            statusCode: StatusCodes.Status500InternalServerError);
    }
});

app.Run();

static InkRecognizer? FindRecognizer(
    IReadOnlyList<InkRecognizer> recognizers,
    string? language)
{
    var terms = language?.ToLowerInvariant() switch
    {
        "en" => new[] { "English", "영어" },
        "vi" => new[] { "Vietnamese", "베트남" },
        _ => new[] { "Korean", "한국" },
    };

    return recognizers.FirstOrDefault(recognizer =>
               terms.Any(term => recognizer.Name.Contains(
                   term,
                   StringComparison.OrdinalIgnoreCase)))
           ?? recognizers.FirstOrDefault();
}

record InkPointDto(double X, double Y, double? T = null, float? Pressure = null);
record InkStrokeDto(List<InkPointDto> Points);
record RecognizeRequest(List<InkStrokeDto> Strokes, string? Language = "ko");
