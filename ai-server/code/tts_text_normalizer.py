import re


_DIGIT_WORDS = {
    "0": "영",
    "1": "일",
    "2": "이",
    "3": "삼",
    "4": "사",
    "5": "오",
    "6": "육",
    "7": "칠",
    "8": "팔",
    "9": "구",
}
_LEADING_ZERO_WORDS = {**_DIGIT_WORDS, "0": "공"}
_SMALL_UNITS = ("", "십", "백", "천")
_LARGE_UNITS = ("", "만", "억", "조", "경")

_NATIVE_ONES = {
    0: "",
    1: "한",
    2: "두",
    3: "세",
    4: "네",
    5: "다섯",
    6: "여섯",
    7: "일곱",
    8: "여덟",
    9: "아홉",
}
_NATIVE_TENS = {
    1: "열",
    2: "스물",
    3: "서른",
    4: "마흔",
    5: "쉰",
    6: "예순",
    7: "일흔",
    8: "여든",
    9: "아흔",
}

_NATIVE_COUNTERS = (
    "개",
    "명",
    "마리",
    "잔",
    "병",
    "대",
    "권",
    "장",
    "시",
    "살",
)
_SINO_UNITS = (
    "원",
    "년",
    "월",
    "일",
    "분",
    "초",
    "층",
    "호",
    "번",
    "퍼센트",
)
_UNIT_PATTERN = "|".join(
    sorted((*_NATIVE_COUNTERS, *_SINO_UNITS), key=len, reverse=True)
)
_NUMBER_PATTERN = r"[+-]?\d[\d,]*(?:\.\d+)?"
_RANGE_PATTERN = r"(?:~|～|–|—)"


def _read_sino_integer(value: int) -> str:
    if value == 0:
        return "영"
    if value < 0:
        return f"마이너스 {_read_sino_integer(-value)}"

    groups = []
    while value:
        groups.append(value % 10000)
        value //= 10000

    parts = []
    for group_index in range(len(groups) - 1, -1, -1):
        group = groups[group_index]
        if group == 0:
            continue

        group_parts = []
        for position in range(3, -1, -1):
            divisor = 10 ** position
            digit = (group // divisor) % 10
            if digit == 0:
                continue
            if digit != 1 or position == 0:
                group_parts.append(_DIGIT_WORDS[str(digit)])
            group_parts.append(_SMALL_UNITS[position])

        if (
            group_index == 1
            and group_index == len(groups) - 1
            and group == 1
        ):
            group_parts.clear()
        group_parts.append(_LARGE_UNITS[group_index])
        parts.append("".join(group_parts))

    return "".join(parts)


def _read_sino_number(raw_number: str) -> str:
    cleaned = raw_number.replace(",", "")
    sign = ""
    if cleaned.startswith(("+", "-")):
        if cleaned[0] == "-":
            sign = "마이너스 "
        cleaned = cleaned[1:]

    integer_part, dot, decimal_part = cleaned.partition(".")
    if len(integer_part) > 1 and integer_part.startswith("0"):
        integer_words = " ".join(_LEADING_ZERO_WORDS[digit] for digit in integer_part)
    else:
        integer_words = _read_sino_integer(int(integer_part or "0"))

    if dot:
        decimal_words = " ".join(_DIGIT_WORDS[digit] for digit in decimal_part)
        return f"{sign}{integer_words} 점 {decimal_words}"
    return f"{sign}{integer_words}"


def _read_native_counter(raw_number: str) -> str:
    cleaned = raw_number.replace(",", "")
    if "." in cleaned or cleaned.startswith("-"):
        return _read_sino_number(raw_number)

    value = int(cleaned.lstrip("+") or "0")
    if value <= 0 or value >= 100:
        return _read_sino_number(raw_number)

    tens, ones = divmod(value, 10)
    if tens == 0:
        return _NATIVE_ONES[ones]
    if value == 20:
        return "스무"
    return f"{_NATIVE_TENS[tens]}{_NATIVE_ONES[ones]}"


def _read_number_with_unit(raw_number: str, unit: str) -> str:
    if unit in _NATIVE_COUNTERS:
        number_words = _read_native_counter(raw_number)
    else:
        number_words = _read_sino_number(raw_number)
    return f"{number_words} {unit}"


def normalize_korean_tts_text(text: str) -> str:
    normalized = str(text)

    repeated_unit_range = re.compile(
        rf"({_NUMBER_PATTERN})\s*({_UNIT_PATTERN})\s*{_RANGE_PATTERN}\s*"
        rf"({_NUMBER_PATTERN})\s*\2"
    )
    normalized = repeated_unit_range.sub(
        lambda match: (
            f"{_read_number_with_unit(match.group(1), match.group(2))}에서 "
            f"{_read_number_with_unit(match.group(3), match.group(2))}"
        ),
        normalized,
    )

    shared_unit_range = re.compile(
        rf"({_NUMBER_PATTERN})\s*{_RANGE_PATTERN}\s*"
        rf"({_NUMBER_PATTERN})\s*({_UNIT_PATTERN})"
    )
    normalized = shared_unit_range.sub(
        lambda match: (
            f"{_read_number_with_unit(match.group(1), match.group(3))}에서 "
            f"{_read_number_with_unit(match.group(2), match.group(3))}"
        ),
        normalized,
    )

    normalized = re.sub(
        rf"₩\s*({_NUMBER_PATTERN})",
        lambda match: f"{_read_sino_number(match.group(1))} 원",
        normalized,
    )
    normalized = re.sub(
        rf"({_NUMBER_PATTERN})\s*%",
        lambda match: f"{_read_sino_number(match.group(1))} 퍼센트",
        normalized,
    )
    normalized = re.sub(
        rf"({_NUMBER_PATTERN})\s*({_UNIT_PATTERN})",
        lambda match: _read_number_with_unit(match.group(1), match.group(2)),
        normalized,
    )
    normalized = re.sub(
        _NUMBER_PATTERN,
        lambda match: _read_sino_number(match.group(0)),
        normalized,
    )

    return re.sub(r"\s+", " ", normalized).strip()
