"""Build the Run-BTI catalogue, import an episode, or read a public source."""
import argparse
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tempfile
from urllib.error import URLError
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET

from feeds import article, candidate, community_items

APP = Path(__file__).resolve().parents[2]
KST = timezone(timedelta(hours=9))
ID = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
CATEGORIES = {"weather", "race", "gear", "community", "routine", "travel"}
SIGNALS = {
    "explore", "scenery", "body", "numbers", "plan", "reset", "reflect", "photo", "company",
    "conversation", "encouragement", "pace", "routine", "goal", "finish", "travel",
    "movement", "enjoyment", "route", "adjust", "solo", "privacy", "compare", "verify", "log", "pause",
    "postStats", "postSelfie", "postScenery", "keepPrivate",
}


def require(ok, message):
    if not ok:
        raise ValueError(message)


def fields(obj, required, optional=()):
    require(isinstance(obj, dict), "JSON 객체가 필요합니다.")
    missing = set(required) - obj.keys()
    extra = obj.keys() - set(required) - set(optional)
    require(not missing and not extra, f"누락된 필드 {sorted(missing)}, 알 수 없는 필드 {sorted(extra)}")


def words(obj, keys):
    for key in keys:
        value = obj[key]
        require(isinstance(value, str) and value.strip() and len(value) <= 1200 and
                not any(ord(ch) < 32 for ch in value), f"{key} 문구를 확인하세요.")


def slug(value):
    require(isinstance(value, str) and len(value) <= 80 and ID.fullmatch(value), f"잘못된 ID {value!r}")


def day(value):
    require(isinstance(value, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value), f"날짜 형식 오류 {value!r}")
    return date.fromisoformat(value)


def issued_at(source):
    words(source, ("issuedAt",))
    moment = datetime.fromisoformat(source["issuedAt"].replace("Z", "+00:00"))
    require(moment.tzinfo is not None, "발표 시각에 UTC나 현지 시차를 표시하세요.")
    return moment


def check_signals(obj, limit):
    if "signals" in obj:
        values = obj["signals"]
        require(isinstance(values, list) and len(values) <= limit
                and all(isinstance(s, str) and s in SIGNALS for s in values),
                f"signals에는 지원하는 행동 단서를 최대 {limit}개 넣으세요.")
        require(len(values) == len(set(values)), "같은 행동 단서가 두 번 들어갔습니다.")


def check_story(row, root):
    mandatory = ("id", "category", "title", "art", "opening", "prompt", "choices", "question")
    fields(row, mandatory, ("source", "links", "validFrom", "validUntil", "signals", "archived"))
    if "archived" in row:
        require(isinstance(row["archived"], bool), "archived에는 true나 false를 넣으세요.")
    check_signals(row, 4)
    words(row, ("title", "opening", "prompt", "question", "category", "art"))
    slug(row["id"])
    require(row["category"] in CATEGORIES, "지원하지 않는 주제입니다.")
    art = row["art"]
    require(re.fullmatch(r"art/[a-z0-9-]+\.webp", art) and (root / art).is_file(), f"그림 파일을 찾을 수 없습니다: {art}")
    choices = row["choices"]
    require(isinstance(choices, list) and 3 <= len(choices) <= 4, "선택지가 세 개 또는 네 개 필요합니다.")
    for choice in choices:
        fields(choice, ("id", "label", "then", "line"), ("next", "signals"))
        check_signals(choice, 2)
        slug(choice["id"])
        words(choice, ("label", "then", "line"))
        if "next" in choice:
            slug(choice["next"])
    require(len({c["id"] for c in choices}) == len(choices) and len({c["label"] for c in choices}) == len(choices),
            "선택지 ID와 문구가 겹칩니다.")
    links = row.get("links", [])
    require(isinstance(links, list), "links에는 에피소드 ID 목록을 넣으세요.")
    for link in links:
        slug(link)
    require(len(set(links)) == len(links), "같은 후속 이야기가 겹칩니다.")
    source = row.get("source")
    if "source" in row:
        fields(source, ("kind", "name", "url", "asOf", "note"), ("issuedAt",))
        words(source, ("kind", "name", "url", "note"))
        require(source["kind"] in {"event", "brand", "community", "weather"}, "출처 종류를 확인하세요.")
        url = urlsplit(source["url"])
        require(url.scheme == "https" and url.hostname and not url.username and not url.password
                and not re.search(r"[\s\\]", source["url"]), "공개 HTTPS 출처 링크를 넣으세요.")
        checked = day(source["asOf"])
        require(checked <= datetime.now(KST).date(), "미래 날짜를 출처 확인일로 쓸 수 없습니다.")
        if "issuedAt" in source:
            require(issued_at(source) <= datetime.now(timezone.utc), "원자료 발표 시각을 확인하세요.")
    if "validFrom" in row or "validUntil" in row:
        first, last = day(row.get("validFrom")), day(row.get("validUntil"))
        require(first <= last, "노출 기간의 시작과 끝을 확인하세요.")
        if source:
            require(checked <= last, "출처 확인일이 노출 종료일보다 늦습니다.")
    if source and source["kind"] == "weather":
        require("validUntil" in row, "예보에는 지역과 날짜를 밝히고 노출 기간을 넣으세요.")


def decode_object(pairs):
    obj = dict(pairs)
    require(len(obj) == len(pairs), "JSON 키가 중복되었습니다.")
    return obj


def read_json(text):
    return json.loads(text, object_pairs_hook=decode_object)


def encode(obj):
    return (json.dumps(obj, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def digest(data):
    return hashlib.sha256(data).hexdigest()


@contextmanager
def lock(path):
    # OS locks disappear when the owning process exits, including after an interruption.
    key = digest(os.path.normcase(str(path.resolve())).encode())
    with (Path(tempfile.gettempdir()) / ("runbti-stories-" + key + ".lock")).open("a+b") as handle:
        if os.name == "nt":
            import msvcrt
            if not handle.tell():
                handle.write(b"0")
                handle.flush()
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_LOCK, 1)
        else:
            import fcntl
            fcntl.flock(handle, fcntl.LOCK_EX)
        yield


def write(path, data):
    if path.exists() and path.read_bytes() == data:
        return
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as handle:
        temporary = Path(handle.name)
    try:
        temporary.write_bytes(data)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def compile_rows(entries, root):
    rows = list(entries.values())
    for row in rows:
        check_story(row, root)
        targets = set(row.get("links", [])) | {c["next"] for c in row["choices"] if "next" in c}
        require(not targets - entries.keys(), f"{row['id']}의 후속 에피소드가 없습니다: {sorted(targets - entries.keys())}")
    # Date-bound additions appear above timeless scenes; ties are stable across machines.
    rows.sort(key=lambda r: r["id"])
    rows.sort(key=lambda r: r.get("validFrom", ""), reverse=True)
    data = json.dumps(rows, ensure_ascii=False, separators=(",", ":"))
    data = data.replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    return ("window.RBStoryCatalog = " + data + ";\n").encode("utf-8")


def story_content(row):
    """Compare the underlying story when importing a feed processed by an older authoring tool."""
    clean = {key: value for key, value in row.items() if key != "signals"}
    clean["choices"] = [{k: v for k, v in choice.items() if k != "signals"} for choice in row["choices"]]
    return clean


def apply(args, new=None, from_feed=False):
    root = args.root.resolve()
    directory = (args.source_dir or root / "stories/episodes").resolve()
    require(directory.is_dir() and (root / "art").is_dir(), "에피소드 원본 폴더와 앱 art 폴더를 확인하세요.")
    output = root / "rb-story-catalog.js"
    with lock(directory), lock(output):
        entries = {}
        for path in sorted(directory.glob("*.json")):
            value = read_json(path.read_text(encoding="utf-8-sig"))
            require(isinstance(value, dict) and value.get("id") == path.stem, f"{path.name} 파일명과 ID가 다릅니다.")
            entries[path.stem] = value
        changed = False
        if new is not None:
            check_story(new, root)
            require(new.get("source") or getattr(args, "fiction", False), "출처가 있는 원고를 넣거나 창작 원고에 --fiction을 붙이세요.")
            key = new["id"]
            old = entries.get(key)
            dest = directory / (key + ".json")
            original = dest.read_bytes() if old is not None else None
            if from_feed and old and story_content(old) == story_content(new):
                new = old  # Keep any previously edited or omitted annotations.
            if old and old != new:
                old_src, src = old.get("source", {}), new.get("source", {})
                require(not old_src or (old_src.get("url") == src.get("url") and
                        old_src.get("asOf", "") <= src.get("asOf", "")), "출처가 바뀌거나 이전 정보로 돌아가는 변경입니다.")
                if from_feed and src.get("kind") == "weather" and old_src.get("issuedAt"):
                    require(issued_at(src) > issued_at(old_src), "같거나 오래된 예보는 기존 원고를 변경할 수 없습니다.")
                else:
                    require((getattr(args, "replace", None) or "").lower() == digest(original),
                            f"{key}가 이미 있습니다. 변경할 원본의 SHA-256은 {digest(original)}입니다.")
            if new.get("source") and new["source"]["kind"] != "weather":
                for other in entries.values():
                    src = other.get("source", {})
                    require(other["id"] == key or src.get("url") != new["source"]["url"] or other["title"] != new["title"],
                            "같은 출처와 제목의 에피소드가 있습니다.")
                    if (from_feed and other["id"] != key and other["opening"] == new["opening"]
                            and story_content(other)["choices"] == story_content(new)["choices"]):
                        print(f"같은 장면 {other['id']}이 있어 추가하지 않았습니다. 새 줄거리는 feed community --items에서 시작하세요.", file=sys.stderr)
                        return
            entries[key] = new
            changed = old != new
        require(entries, "에피소드 원고가 비어 있습니다.")
        catalog = compile_rows(entries, root)
        if changed:
            write(dest, encode(new))
        try:
            write(output, catalog)
        except OSError:
            if changed:
                if original is None:
                    dest.unlink()
                else:
                    write(dest, original)
            raise
    print(f"{len(entries)} episodes -> {output}", file=sys.stderr)


def main():
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=APP)
    parser.add_argument("--source-dir", type=Path)
    cmds = parser.add_subparsers(dest="command", required=True)
    cmds.add_parser("build")
    imp = cmds.add_parser("import")
    imp.add_argument("file", help="UTF-8 JSON file or - for stdin")
    imp.add_argument("--fiction", action="store_true")
    imp.add_argument("--replace", metavar="PREVIOUS_SHA256")
    feeds = cmds.add_parser("feed")
    feeds.add_argument("provider", choices=("community", "weather"))
    mode = feeds.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true")
    mode.add_argument("--items", action="store_true", help="List community feed metadata for agent-written episodes")
    news = cmds.add_parser("article")
    news.add_argument("kind", choices=("event", "brand"))
    news.add_argument("url")
    news.add_argument("--published", metavar="YYYY-MM-DD")
    news.add_argument("--from", dest="start", metavar="YYYY-MM-DD")
    news.add_argument("--until", dest="end", metavar="YYYY-MM-DD")
    news.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if args.command == "build":
        apply(args)
    elif args.command == "import":
        raw = sys.stdin.buffer.read() if args.file == "-" else Path(args.file).read_bytes()
        apply(args, read_json(raw.decode("utf-8-sig")))
    elif args.command == "feed" and args.items:
        require(args.provider == "community", "--items는 커뮤니티 RSS용입니다.")
        print(json.dumps(community_items(), ensure_ascii=False, indent=2))
    else:
        row = (article(args.kind, args.url, args.published, args.start, args.end)
               if args.command == "article" else candidate(args.provider))
        check_story(row, args.root)
        if args.apply:
            apply(args, row, from_feed=True)
        else:
            print(json.dumps(row, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (OSError, URLError, ValueError, KeyError, TypeError, ET.ParseError) as exc:
        sys.exit(f"story-agent: {exc}")
