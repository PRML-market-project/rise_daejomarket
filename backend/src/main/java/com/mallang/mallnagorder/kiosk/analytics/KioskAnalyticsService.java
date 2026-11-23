package com.mallang.mallnagorder.kiosk.analytics;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mallang.mallnagorder.kiosk.experience.service.KioskExperienceService;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import java.io.IOException;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class KioskAnalyticsService {
    static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private final KioskAnalyticsRepository repository;
    private final KioskExperienceService experience;
    private final ObjectMapper mapper;
    private final Map<String, Target> catalog;
    record Target(String id, String name, String category, List<String> products) {}
    public record EventRequest(String id, String type, String sessionId, String source, String language, List<String> targetIds, Instant occurredAt) {}
    public record Bucket(String key, long count) {}
    public record Rank(String id, String name, long count) {}
    public record Summary(LocalDate start, LocalDate end, int year, long totalUses, long searches, long noResults,
                          List<Bucket> months, List<Bucket> days, List<Bucket> hours,
                          List<Rank> shops, List<Rank> categories, List<Rank> products, Instant generatedAt) {}

    public KioskAnalyticsService(KioskAnalyticsRepository repository, KioskExperienceService experience, ObjectMapper mapper) throws IOException {
        this.repository = repository; this.experience = experience; this.mapper = mapper;
        try (var input = new ClassPathResource("analytics/shop-catalog.json").getInputStream()) {
            List<Target> targets = mapper.readValue(input, new TypeReference<>() {});
            catalog = targets.stream().collect(Collectors.toUnmodifiableMap(Target::id, Function.identity()));
        }
    }

    public void record(EventRequest request) {
        if (request == null) throw new IllegalArgumentException("이벤트가 필요합니다.");
        uuid(request.id()); uuid(request.sessionId());
        if (!Set.of("START", "SEARCH", "SELECT", "DIRECTIONS").contains(Objects.toString(request.type(), ""))
                || !Set.of("keyboard", "voice", "handwriting", "tag", "touch").contains(Objects.toString(request.source(), ""))
                || !Set.of("ko", "en", "vi").contains(Objects.toString(request.language(), "")))
            throw new IllegalArgumentException("지원하지 않는 이벤트입니다.");
        if (repository.existsById(request.id())) return;
        var ids = request.targetIds() == null ? List.<String>of() : request.targetIds();
        if (ids.size() > 500 || ids.stream().anyMatch(id -> id == null || !catalog.containsKey(id)))
            throw new IllegalArgumentException("등록된 점포 ID만 기록할 수 있습니다.");
        if (Set.of("SELECT", "DIRECTIONS").contains(request.type()) && ids.size() != 1)
            throw new IllegalArgumentException("점포 한 곳을 선택해주세요.");
        if ("START".equals(request.type()) && !ids.isEmpty()) throw new IllegalArgumentException("시작 이벤트에는 점포가 없습니다.");
        var overrides = ids.isEmpty() ? Map.<String, com.mallang.mallnagorder.kiosk.experience.dto.ManagedShopDto>of()
                : experience.get().getShops().stream().collect(Collectors.toMap(s -> s.getId(), Function.identity(), (a, b) -> b));
        List<Target> targets = ids.stream().distinct().map(id -> {
            var base = catalog.get(id); var override = overrides.get(id);
            if (override == null) return base;
            return new Target(id, override.getName(), base.category(), override.getTags() == null ? List.of() : override.getTags().stream().filter(Objects::nonNull).filter(t -> !t.isBlank()).distinct().toList());
        }).toList();
        var event = new KioskAnalyticsEvent();
        event.setId(request.id()); event.setSessionId(request.sessionId()); event.setType(request.type());
        var now = Instant.now(); var occurredAt = request.occurredAt() == null ? now : request.occurredAt();
        if (occurredAt.isAfter(now.plusSeconds(300)) || occurredAt.isBefore(now.minus(7, ChronoUnit.DAYS)))
            throw new IllegalArgumentException("이벤트 기록 시각을 확인해주세요.");
        event.setSource(request.source()); event.setLanguage(request.language()); event.setOccurredAt(occurredAt);
        event.setTargetsJson(write(targets));
        repository.saveAndFlush(event);
    }

    private void uuid(String value) {
        try { if (value == null || !UUID.fromString(value).toString().equals(value)) throw new IllegalArgumentException(); }
        catch (IllegalArgumentException ex) { throw new IllegalArgumentException("올바른 이벤트·세션 ID가 필요합니다."); }
    }

    public Summary summary(LocalDate start, LocalDate end, int year) {
        validateRange(start, end);
        if (year < 2020 || year > LocalDate.now(KST).getYear()) throw new IllegalArgumentException("조회 연도를 확인해주세요.");
        var yearStart = LocalDate.of(year, 1, 1); var yearEnd = yearStart.plusYears(1);
        var events = events(start.isBefore(yearStart) ? start : yearStart, end.plusDays(1).isAfter(yearEnd) ? end.plusDays(1) : yearEnd);
        Map<String, Long> months = new TreeMap<>(), days = new TreeMap<>(), hours = new TreeMap<>();
        for (var event : events) if ("START".equals(event.getType())) {
            var time = event.getOccurredAt().atZone(KST);
            if (time.getYear() == year) {
                months.merge(time.toLocalDate().toString().substring(0, 7), 1L, Long::sum);
                days.merge(time.toLocalDate().toString(), 1L, Long::sum);
                hours.merge(time.toLocalDate() + "T" + String.format("%02d", time.getHour()), 1L, Long::sum);
            }
        }
        var selected = events.stream().filter(e -> inRange(e, start, end)).toList();
        return new Summary(start, end, year, count(selected, "START"), count(selected, "SEARCH"),
                selected.stream().filter(e -> "SEARCH".equals(e.getType()) && targets(e).isEmpty()).count(),
                buckets(months), buckets(days), buckets(hours), ranks(selected, "shops"), ranks(selected, "categories"), ranks(selected, "products"), Instant.now());
    }

    private boolean inRange(KioskAnalyticsEvent event, LocalDate start, LocalDate end) {
        var date = event.getOccurredAt().atZone(KST).toLocalDate();
        return !date.isBefore(start) && !date.isAfter(end);
    }
    private long count(List<KioskAnalyticsEvent> events, String type) { return events.stream().filter(e -> type.equals(e.getType())).count(); }
    private List<Bucket> buckets(Map<String, Long> counts) { return counts.entrySet().stream().map(e -> new Bucket(e.getKey(), e.getValue())).toList(); }
    private List<Rank> ranks(List<KioskAnalyticsEvent> events, String kind) {
        Map<String, Long> counts = new HashMap<>(); Map<String, String> names = new HashMap<>();
        for (var event : events) {
            if ("shops".equals(kind)) {
                if (!Set.of("SELECT", "DIRECTIONS").contains(event.getType())) continue;
                for (var target : targets(event)) { counts.merge(target.id(), 1L, Long::sum); names.put(target.id(), target.name()); }
            } else if ("SEARCH".equals(event.getType())) {
                Set<String> terms = new HashSet<>();
                for (var target : targets(event)) {
                    if ("categories".equals(kind)) terms.add(target.category()); else terms.addAll(target.products());
                }
                terms.stream().filter(t -> t != null && !t.isBlank()).forEach(t -> { counts.merge(t, 1L, Long::sum); names.put(t, t); });
            }
        }
        return counts.entrySet().stream().map(e -> new Rank(e.getKey(), names.get(e.getKey()), e.getValue()))
                .sorted(Comparator.comparingLong(Rank::count).reversed().thenComparing(Rank::id)).toList();
    }
    private List<KioskAnalyticsEvent> events(LocalDate start, LocalDate endExclusive) {
        return repository.findByOccurredAtGreaterThanEqualAndOccurredAtLessThanOrderByOccurredAtAsc(start.atStartOfDay(KST).toInstant(), endExclusive.atStartOfDay(KST).toInstant());
    }
    private void validateRange(LocalDate start, LocalDate end) {
        if (start == null || end == null || end.isBefore(start) || ChronoUnit.DAYS.between(start, end) > 366 || end.isAfter(LocalDate.now(KST)))
            throw new IllegalArgumentException("조회 기간은 오늘까지 최대 367일입니다.");
    }
    private List<Target> targets(KioskAnalyticsEvent event) {
        try { return mapper.readValue(event.getTargetsJson(), new TypeReference<>() {}); }
        catch (IOException ex) { throw new IllegalStateException("집계 기록을 읽지 못했습니다.", ex); }
    }
    private String write(Object value) {
        try { return mapper.writeValueAsString(value); } catch (IOException ex) { throw new IllegalStateException(ex); }
    }

    public String csv(LocalDate start, LocalDate end, String kind) {
        validateRange(start, end);
        StringBuilder csv = new StringBuilder("\uFEFF");
        var events = events(start, end.plusDays(1));
        if ("events".equals(kind)) {
            row(csv, "event_id", "occurred_at_kst", "session_id", "event_type", "source", "language", "shop_ids", "shop_names", "categories", "products");
            for (var event : events) {
                var targets = targets(event);
                row(csv, event.getId(), event.getOccurredAt().atZone(KST).toOffsetDateTime().toString(), event.getSessionId(), event.getType(), event.getSource(), event.getLanguage(),
                        targets.stream().map(Target::id).collect(Collectors.joining("|")), targets.stream().map(Target::name).collect(Collectors.joining("|")),
                        targets.stream().map(Target::category).distinct().collect(Collectors.joining("|")), targets.stream().flatMap(t -> t.products().stream()).distinct().collect(Collectors.joining("|")));
            }
        } else if ("summary".equals(kind)) {
            row(csv, "section", "period", "id", "name", "count");
            for (var unit : List.of("year", "month", "day")) {
                Map<String, Long> counts = new TreeMap<>();
                for (var event : events) if ("START".equals(event.getType())) {
                    String day = event.getOccurredAt().atZone(KST).toLocalDate().toString();
                    counts.merge(day.substring(0, "year".equals(unit) ? 4 : "month".equals(unit) ? 7 : 10), 1L, Long::sum);
                }
                counts.forEach((key, count) -> row(csv, "uses_" + unit, key, "", "", count.toString()));
            }
            for (var section : List.of("shops", "categories", "products")) for (var rank : ranks(events, section))
                row(csv, section, start + " ~ " + end, rank.id(), rank.name(), Long.toString(rank.count()));
            row(csv, "searches", start + " ~ " + end, "", "", Long.toString(count(events, "SEARCH")));
            row(csv, "no_results", start + " ~ " + end, "", "", Long.toString(events.stream().filter(e -> "SEARCH".equals(e.getType()) && targets(e).isEmpty()).count()));
        } else throw new IllegalArgumentException("다운로드 자료를 선택해주세요.");
        return csv.toString();
    }
    private void row(StringBuilder out, String... values) {
        out.append(Arrays.stream(values).map(v -> {
            String safe = Objects.toString(v, "");
            if (safe.stripLeading().matches("^[=+@\\-].*")) safe = "'" + safe;
            return "\"" + safe.replace("\"", "\"\"") + "\"";
        }).collect(Collectors.joining(","))).append("\r\n");
    }
}
