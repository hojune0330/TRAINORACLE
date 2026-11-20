"""Read one bounded public feed. Only dates, public metadata and forecast numbers enter a story."""
from datetime import datetime, time, timedelta, timezone
from email.utils import parsedate_to_datetime
import hashlib
import html
from html.parser import HTMLParser
import json
import math
import re
import urllib.request
from urllib.parse import urlsplit, urlunsplit
import xml.etree.ElementTree as ET

KST = timezone(timedelta(hours=9))
PARKRUN = "https://blog.parkrun.com/uk/feed/"
FORECAST = "https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=37.5665&lon=126.9780"


def fetch(url, opener=None):
    req = urllib.request.Request(url, headers={"User-Agent": "RunBTI/1.0 (+https://trainoracle.io/run-bti/)"})
    open_request = opener.open if opener else urllib.request.urlopen
    with open_request(req, timeout=15) as response:
        body = response.read(2_000_001)
    if len(body) > 2_000_000:
        raise ValueError("피드 크기 제한을 넘었습니다.")
    return body


def choices(rows):
    return [{"id": key, "label": label, "then": then, "line": line, "signals": signals}
            for key, label, then, line, signals in rows]


class SummaryText(HTMLParser):
    """Extract a short reading cue for the authoring agent, never for the public catalogue."""
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, text):
        self.parts.append(text)


def community_items():
    body = fetch(PARKRUN)
    if b"<!ENTITY" in body.upper() or b"<!DOCTYPE" in body.upper():
        raise ValueError("RSS 항목을 읽을 수 없습니다.")
    tree = ET.fromstring(body)
    rows = []
    today = datetime.now(KST).date()
    for elem in tree.findall("./channel/item")[:20]:
        url = elem.findtext("link", "").strip()
        parts = urlsplit(url)
        if parts.scheme != "https" or parts.netloc != "blog.parkrun.com" or not parts.path.startswith("/uk/"):
            continue
        title = html.unescape(elem.findtext("title", "")).strip()
        published = parsedate_to_datetime(elem.findtext("pubDate")).date()
        if title and 0 <= (today - published).days <= 30:
            summary = SummaryText()
            summary.feed(elem.findtext("description", ""))
            rows.append({"title": title[:200], "url": url, "date": published.isoformat(),
                         "readingCue": " ".join(" ".join(summary.parts).split()[:24]),
                         "tags": [html.unescape(c.text).strip() for c in elem.findall("category") if c.text]})
    return sorted(rows, key=lambda item: item["date"], reverse=True)


# Stories use the publisher's topic tags. They never attribute the imaginary dialogue to a contributor.
COMMUNITY = {
    "volunteering": (
        "이번 토요일엔 내가 도와줄게", "art/q-09.webp",
        "토요일 러닝 모임에 도와줄 사람이 한 명 더 필요하대. 뛰러 가려던 친구도 잠깐 들를 수 있대서 둘이 뭘 맡을지 얘기 중이야.",
        "이번에 가면 어떤 일을 맡고 싶어?",
        [("welcome", "처음 온 사람한테 모이는 곳 알려 주기", "누가 벤치 앞에서 두리번거리길래 먼저 손을 들었어. 옆에 앉더니 오늘 처음 왔다고 하네.", "처음 오면 사람들한테 다가가는 게 제일 어렵더라.", ["encouragement", "conversation"]),
         ("corner", "갈림길에서 돌아오는 사람들 기다리기", "먼저 간 친구가 돌아오다 널 발견하고 웃었어. 달리는 모습을 이렇게 오래 본 건 처음이야.", "뛸 때는 몰랐는데 저기서부터 다들 표정이 보여.", ["route", "encouragement"]),
         ("pack", "끝나고 남을 사람들하고 짐 정리하기", "반환점 표지판을 접고 보니 늦게 온 사람도 인사할 틈이 생겼어. 다음 주에도 올 거냐고 물어봐.", "정리하면서 한 얘기가 뛰면서 한 얘기보다 길었어.", ["company"])],
        "네가 처음 모임에 갔을 때 누가 뭘 해 줘서 편했어?", "자원봉사", ["encouragement", "company"], {"volunteering", "volunteers", "volunteer"}),
    "winter": (
        "추워진 뒤로 약속 시간이 달라졌어", "art/bg-07.webp",
        "늘 아침 일찍 모이던 친구가 이번 주엔 해 뜬 뒤에 만나자고 해. 단톡에 올라온 답이 조금씩 달라.",
        "네가 정할 수 있다면 뭘 바꾸고 싶어?",
        [("later", "해 올라온 다음에 만나자", "늦춰 잡은 시간에 가니 평소 그냥 지나치던 빵집이 열려 있어. 돌아오는 길 간식까지 정했어.", "한 시간 늦게 나왔더니 이 집이 벌써 열었네.", ["adjust", "plan"]),
         ("short", "각자 뛰고 짧게라도 얼굴 보자", "친구는 먼저 한 바퀴 돌았고 너는 이제 출발이야. 벤치 앞에서 인사를 나누고 서로 길을 갔어.", "오늘은 딱 인사만 해도 오길 잘했다 싶어.", ["solo", "company"]),
         ("inside", "이번엔 안에서 만나고 다음에 뛰자", "따뜻한 데 앉아 다음에 같이 갈 길을 지도에 찍었어. 평소 뛰느라 못 했던 얘기도 다 했어.", "오늘은 코스만 골랐어. 다음에 여기서 만나자.", ["adjust", "company"])],
        "추워지면 모이는 시간부터 바꿔, 아니면 뛰는 길부터 바꿔?", "겨울 러닝", ["adjust", "company", "plan"], {"cold weather", "winter", "winter running"}),
    "junior": (
        "오늘 출발은 제일 어린 러너가 정해", "art/q-11.webp",
        "주말에 가족이랑 공원을 한 바퀴 돌아보기로 했어. 같이 온 아이는 뛰다 말고 낙엽을 한 움큼 주워 들었어.",
        "다음 한 바퀴는 어떻게 갈래?",
        [("lead", "다음 나무까지 아이가 앞장서게 해", "앞으로 나간 아이가 큰 나무에서 돌아봤어. 이번에는 손으로 다음 나무를 짚어 주네.", "다음엔 어느 나무까지 갈까?", ["encouragement"]),
         ("walk", "주운 낙엽을 들고 조금 같이 걸어", "걷는 동안 손바닥만 한 잎도 찾았어. 집에 가지고 갈 건 아이가 골랐어.", "이거 집까지 누가 안 구기고 들고 가나 해 볼까?", ["company", "scenery"]),
         ("meet", "각자 가족과 편한 길로 가서 다시 만나", "갈림길에서 나눠 걷고 분수 앞에서 다시 모였어. 누가 뭘 봤는지 얘기가 한꺼번에 나와.", "똑같은 공원에 있었는데 본 게 하나도 안 겹치네.", ["route", "company"])],
        "누구랑 가면 평소와 다른 속도로 달리게 돼?", "어린이 러닝", ["company", "pace", "scenery"], {"junior parkrun", "junior parkruns"}),
}


def community():
    for item in community_items():
        tags = {tag.lower() for tag in item["tags"]}
        matched = next((v for v in COMMUNITY.values() if tags & v[-1]), None)
        if matched:
            title, art, opening, prompt, options, question, topic, signals, _ = matched
            date = datetime.fromisoformat(item["date"]).date()
            return {
                "id": "parkrun-" + hashlib.sha256(item["url"].encode()).hexdigest()[:16], "category": "community",
                "title": title, "art": art, "opening": opening, "prompt": prompt, "choices": choices(options), "signals": signals,
                "question": question, "validFrom": date.isoformat(), "validUntil": (date + timedelta(days=30)).isoformat(),
                "source": {"kind": "community", "name": "parkrun UK · " + item["title"], "url": item["url"],
                           "asOf": item["date"], "note": f"parkrun UK가 {item['date']}에 올린 글을 참고해 ‘{topic}’에 관한 장면과 대화를 새로 썼어요."},
            }
    raise ValueError("최근 30일 RSS에서 지원하는 주제의 글을 찾지 못했습니다. feed community --items로 다른 글을 고를 수 있습니다.")


def weather():
    feed = json.loads(fetch(FORECAST))["properties"]
    now = datetime.now(KST)
    target = datetime.combine(now.date() + timedelta(days=1), time(8), tzinfo=KST)
    issued = datetime.fromisoformat(feed["meta"]["updated_at"].replace("Z", "+00:00"))
    if not timedelta() <= now - issued <= timedelta(days=1):
        raise ValueError("예보가 갱신된 지 하루가 지났거나 발표 시각이 맞지 않습니다.")
    stamp = target.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    data = next((row["data"] for row in feed["timeseries"] if row["time"] == stamp), None)
    if data is None:
        raise ValueError("내일 오전 8시 서울 예보가 없습니다.")
    temp = data["instant"]["details"]["air_temperature"]
    rain = data["next_1_hours"]["details"]["precipitation_amount"]
    units = feed["meta"]["units"]
    if units["air_temperature"] != "celsius" or units["precipitation_amount"] != "mm" or not all(
            isinstance(value, (float, int)) and math.isfinite(value) for value in (temp, rain)) or rain < 0:
        raise ValueError("기온 또는 강수량의 값과 단위를 확인할 수 없습니다.")
    when = f"{target.month}월 {target.day}일"
    opening = f"{when} 오전 8시에 서울에서 뛰기로 한 약속 전날이야. 그 시간 서울시청 부근 예상 기온은 {temp:g}도래. "
    if rain > 0:
        opening += "그때부터 한 시간은 강수 예보도 있어서 친구랑 만날 곳을 다시 보는 중이야."
    elif temp < 5:
        opening += "얇은 겉옷이랑 장갑을 현관에 꺼내 뒀는데 친구는 몇 시에 나올지 아직 고민이래."
    else:
        opening += "친구가 내일 일정을 물어서 평소 뛰는 길이랑 만날 시간을 같이 열어 봤어."
    return {
        "id": "seoul-forecast-" + target.date().isoformat(), "category": "weather", "title": when + " 오전 8시, 서울 러닝 약속",
        "signals": ["plan", "company", "adjust"],
        "art": "art/story-cold.webp" if temp < 5 else ("art/story-rain.webp" if rain > 0 else "art/q-00.webp"),
        "opening": opening, "prompt": "약속을 잡기 전에 뭘 먼저 정할래?",
        "choices": choices([
            ("check", "아침에 예보 다시 보고 연락하자", "알람 아래에 ‘창밖 보고 연락’이라고 적어 뒀어. 오늘 밤에는 옷만 골라 놓기로 했어.", "내일 눈 뜨면 창밖부터 보고 톡할게.", ["plan"]),
            ("change", "둘 다 편한 시간으로 다시 잡자", "친구도 조금 늦게 만나고 싶었대. 둘 다 되는 시간을 찾고 나니 약속이 더 편해졌어.", "우리 둘 다 좀 여유 있을 때 나가자.", ["adjust", "company"]),
            ("other", "이번엔 실내에서 같이 움직이자", "집 근처에서 가기 쉬운 실내 장소를 하나 골랐어. 만나자는 약속은 그대로 남았어.", "오늘은 안에서 만나자. 동네 한 바퀴는 다음에도 되잖아.", ["movement", "company"])]),
        "question": "날씨 때문에 약속을 바꿀 때 시간, 장소, 옷차림 중 뭘 먼저 정해?",
        "validFrom": now.date().isoformat(), "validUntil": now.date().isoformat(),
        "source": {"kind": "weather", "name": "MET Norway · 서울 예보 (CC BY 4.0)", "url": FORECAST,
                   "asOf": issued.astimezone(KST).date().isoformat(), "issuedAt": issued.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                   "note": f"{issued.astimezone(KST):%Y-%m-%d %H:%M} 한국시간 발표. 서울시청 부근 {target:%Y-%m-%d} 08시 기온 {temp:g}°C, 08~09시 예상 강수량 {rain:g}mm. 이 예보를 바탕으로 장면을 지었어요."},
    }


def candidate(provider):
    return community() if provider == "community" else weather()


ARTICLE_SITES = {
    "event": {"news.seoul.go.kr": ("/culture/archives/", "서울특별시"),
              "english.seoul.go.kr": ("/", "서울특별시")},
    "brand": {"about.nike.com": ("/en/newsroom/releases/", "나이키"),
              "www.brooksrunning.com": ("/en_us/", "브룩스")},
}


def publisher(url, kind):
    p = urlsplit(url)
    site = ARTICLE_SITES[kind].get(p.netloc)
    if p.scheme != "https" or not site or not p.path.startswith(site[0]) or p.path == site[0] or "\\" in url:
        raise ValueError("지원하는 공식 원문 URL을 넣으세요. 허용 경로는 README에 있습니다.")
    return site[1]


class ArticleRedirect(urllib.request.HTTPRedirectHandler):
    def __init__(self, kind):
        self.kind = kind

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        publisher(newurl, self.kind)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class ArticleMeta(HTMLParser):
    def __init__(self):
        super().__init__()
        self.meta = {}
        self.title = ""
        self.part = None
        self.ld = ""
        self.dates = set()

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "meta":
            self.meta[a.get("property") or a.get("name")] = a.get("content", "")
        elif tag == "title":
            self.part = "title"
        elif tag == "script" and a.get("type") == "application/ld+json":
            self.part, self.ld = "json", ""

    def handle_data(self, text):
        if self.part == "title":
            self.title += text
        elif self.part == "json":
            self.ld += text

    def handle_endtag(self, tag):
        if tag == "script" and self.part == "json":
            try:
                data = json.loads(self.ld)
                nodes = data.get("@graph", [data]) if isinstance(data, dict) else data
                for node in nodes if isinstance(nodes, list) else []:
                    if isinstance(node, dict) and isinstance(node.get("datePublished"), str):
                        self.dates.add(node["datePublished"][:10])
            except ValueError:
                pass
        if tag in ("title", "script"):
            self.part = None


def article(kind, address, published, start, end):
    name = publisher(address, kind)
    parts = urlsplit(address)
    url = urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))
    parser = ArticleMeta()
    parser.feed(fetch(url, urllib.request.build_opener(ArticleRedirect(kind))).decode("utf-8"))
    title = " ".join((parser.meta.get("og:title") or parser.title).split())
    if not title or len(title) > 220:
        raise ValueError("원문의 제목을 확인할 수 없습니다.")
    context = title + " " + (parser.meta.get("og:description") or parser.meta.get("description") or "")
    terms = (r"마라톤|달리기|러닝|marathon|running|road race|10k|5k" if kind == "event"
             else r"러닝화|운동화|러닝슈즈|running shoe|footwear|road shoe|race.day|vaporfly|vomero")
    if not re.search(terms, context, re.I):
        raise ValueError("원문의 제목·설명에서 러닝 대회나 러닝화 주제를 확인할 수 없습니다.")
    stamped = parser.meta.get("article:published_time", "")[:10]
    if not stamped and len(parser.dates) == 1:
        stamped = next(iter(parser.dates))
    if not stamped and not published:
        raise ValueError("공식 문서에서 날짜를 확인한 뒤 --published YYYY-MM-DD를 넣으세요.")
    if stamped and published and stamped != published:
        raise ValueError(f"입력 날짜와 원문의 기준일 {stamped}가 다릅니다.")
    asof = stamped or published
    if kind == "event":
        category, art, heading = "race", "art/story-cheer.webp", "대회 공지가 단톡에 올라왔어"
        signals = ["plan", "encouragement", "route", "verify"]
        opening = f"친구가 {name}에 올라온 대회 안내를 단톡에 보냈어. 다음에 같이 가면 어디서 만나는 게 좋겠냐고 물어봐."
        prompt, question = "공지를 열면 뭘 먼저 찾아볼래?", "큰 대회에서 친구와 약속 잡을 때 꼭 정해 두는 게 있어?"
        options = [
            ("meet", "끝나고 만날 만한 장소", "친구랑 지도에서 찾기 쉬운 건물 하나를 골랐어. 다음에 가면 서로 헤매지 않을 것 같아.", "사람 많아도 저 큰 건물은 보이겠다.", ["plan", "route"]),
            ("cheer", "밖에서 응원하기 좋은 자리", "지도를 보며 달리는 길과 나란히 걸을 만한 곳을 찾았어. 친구가 다음엔 응원 사진도 남기자고 해.", "나 응원 갈 때는 너 표정 나오는 데 서고 싶어.", ["encouragement"]),
            ("calendar", "나중에 다시 볼 공식 안내", "둘 다 오늘은 시간이 없어서 원문 링크만 남겼어. 다음에 일정 잡을 땐 같은 공지를 펴 보기로 했어.", "우리 날짜 정할 때 이 링크부터 다시 보자.", ["plan", "verify"]) ]
    else:
        category, art, heading = "gear", "art/story-shoes.webp", "새 러닝화 사진을 보고 난 뒤"
        signals = ["body", "compare", "reflect"]
        opening = f"단톡에 {name} 러닝화 소식이 올라왔어. 친구가 사진을 확대하다가 네가 신발을 고를 때 뭐부터 보는지 물어봐."
        prompt, question = "친구한테 뭐라고 답할래?", "신발을 신어 보기 전에 꼭 알아두고 싶은 것 하나만 고른다면?"
        options = [
            ("compare-width", "난 매장에서 내 신발이랑 발볼부터 비교해 볼래", "매장에 갈 땐 늘 신는 운동화를 신고 가기로 했어. 같은 양말에 신발만 바꿔 신으면 어디가 더 넉넉한지 알 수 있겠다.", "난 엄지발가락 옆이 자꾸 눌리거든. 두 켤레 다 신어 볼래.", ["compare", "body"]),
            ("purpose", "내가 어디서 뛸 건지 먼저 생각해", "평소 운동장보다 출퇴근길에 뛰는 날이 많더라. 다음 신발에 바라는 게 조금 또렷해졌어.", "난 회사 앞 횡단보도부터 같이 다닐 신발이 필요해.", ["reflect", "route"]),
            ("keep", "난 지금 신는 게 편해서 사진만 볼래", "새 색상이 마음에 들어서 사진을 한 번 더 보고 닫았어. 내일 신을 운동화는 이미 현관에 있어.", "구경하는 것도 재밌어. 이번엔 여기까지만.", ["body", "enjoyment"]) ]
    result = {
        "id": kind + "-news-" + hashlib.sha256(url.encode()).hexdigest()[:16],
        "category": category, "signals": signals, "title": heading, "art": art, "opening": opening, "prompt": prompt,
        "choices": choices(options), "question": question,
        "source": {"kind": kind, "name": name + " · " + title, "url": url, "asOf": asof,
                   "note": f"공식 문서의 기준일은 {asof}이에요. 이 원문에서 소재를 얻어 장면과 대화를 지었어요."},
    }
    if start or end:
        result.update(validFrom=start, validUntil=end)
    return result
