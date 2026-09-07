#!/usr/bin/env python3
"""Fetch one approved page or a bounded set of pages from one approved website.

The caller sends JSON on stdin. Full HTML is never returned or stored: output is
a content hash, the exact pages visited, and a compact evidence package.
"""

from __future__ import annotations

import hashlib
import ipaddress
import json
import os
import posixpath
import socket
import sys
import time
from html.parser import HTMLParser
from typing import Any
from urllib.error import HTTPError
from urllib.parse import urljoin, urlparse, urlunparse
from urllib.request import HTTPRedirectHandler, Request, build_opener
from urllib.robotparser import RobotFileParser


USER_AGENT = "KnowledgeMapSourceMonitor/1.0 (+content-review; bounded; no-full-text-storage)"
IGNORED_EXTENSIONS = {
    ".7z", ".avi", ".css", ".csv", ".doc", ".docx", ".gif", ".gz", ".ico",
    ".jpeg", ".jpg", ".js", ".json", ".mov", ".mp3", ".mp4", ".pdf", ".png",
    ".ppt", ".pptx", ".rar", ".rss", ".svg", ".tar", ".webp", ".xls", ".xlsx",
    ".xml", ".zip",
}


class EvidenceParser(HTMLParser):
    BLOCKED = {"script", "style", "noscript", "svg", "nav", "footer", "form"}
    TEXT_TAGS = {"title", "h1", "h2", "h3", "p", "li"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.blocked_depth = 0
        self.active_tag: str | None = None
        self.buffer: list[str] = []
        self.title = ""
        self.passages: list[str] = []
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in self.BLOCKED:
            self.blocked_depth += 1
        if tag == "a":
            href = next((value for name, value in attrs if name == "href"), None)
            if href:
                self.links.append(href)
        if self.blocked_depth == 0 and tag in self.TEXT_TAGS:
            self.active_tag = tag
            self.buffer = []

    def handle_endtag(self, tag: str) -> None:
        if self.blocked_depth == 0 and tag == self.active_tag:
            text = " ".join("".join(self.buffer).split())
            if tag == "title" and text:
                self.title = text[:300]
            elif len(text) >= 20:
                self.passages.append(text[:1200])
            self.active_tag = None
            self.buffer = []
        if tag in self.BLOCKED and self.blocked_depth > 0:
            self.blocked_depth -= 1

    def handle_data(self, data: str) -> None:
        if self.blocked_depth == 0 and self.active_tag:
            self.buffer.append(data)


def assert_public_https(url: str) -> None:
    parsed = urlparse(url)
    allow_http = os.environ.get("CRAWLER_ALLOW_HTTP") == "true"
    if parsed.scheme != "https" and not (allow_http and parsed.scheme == "http"):
        raise ValueError("source URL must use HTTPS")
    if not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("invalid source host")
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    for result in socket.getaddrinfo(parsed.hostname, port, type=socket.SOCK_STREAM):
        address = ipaddress.ip_address(result[4][0])
        if not address.is_global and not allow_http:
            raise ValueError("source host resolves to a non-public address")


def origin(url: str) -> tuple[str, str, int]:
    parsed = urlparse(url)
    return parsed.scheme.lower(), (parsed.hostname or "").lower(), parsed.port or (443 if parsed.scheme == "https" else 80)


class SafeRedirectHandler(HTTPRedirectHandler):
    def __init__(self, allowed_origin: tuple[str, str, int] | None = None) -> None:
        super().__init__()
        self.allowed_origin = allowed_origin

    def redirect_request(self, req: Request, fp: Any, code: int, msg: str, headers: Any, newurl: str) -> Request | None:
        target = urljoin(req.full_url, newurl)
        assert_public_https(target)
        if self.allowed_origin and origin(target) != self.allowed_origin:
            raise ValueError("website crawl redirect left the approved host")
        return super().redirect_request(req, fp, code, msg, headers, target)


def choose_evidence(passages: list[str], keywords: list[str], limit: int, item_limit: int = 12) -> list[str]:
    normalized = [word.strip().lower() for word in keywords if len(word.strip()) >= 2]

    def score(item: tuple[int, str]) -> tuple[int, int]:
        index, text = item
        lowered = text.lower()
        return sum(1 for word in normalized if word in lowered), -index

    chosen: list[str] = []
    used = 0
    for _, passage in sorted(enumerate(passages), key=score, reverse=True):
        remaining = limit - used
        if remaining < 20:
            break
        excerpt = passage[: min(800, remaining)]
        if excerpt not in chosen:
            chosen.append(excerpt)
            used += len(excerpt)
        if len(chosen) >= item_limit:
            break
    return chosen


def read_page(opener: Any, url: str, max_bytes: int, timeout: int, headers: dict[str, str] | None = None) -> dict[str, Any]:
    request_headers = {"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"}
    request_headers.update(headers or {})
    response_context = opener.open(Request(url, headers=request_headers), timeout=timeout)
    with response_context as response:
        content_type = (response.headers.get_content_type() or "").lower()
        if content_type not in {"text/html", "application/xhtml+xml"}:
            raise ValueError(f"unsupported content type: {content_type or 'unknown'}")
        body = response.read(max_bytes + 1)
        if len(body) > max_bytes:
            raise ValueError("source response exceeds configured size limit")
        final_url = response.geturl()
        assert_public_https(final_url)
        charset = response.headers.get_content_charset() or "utf-8"
        parser = EvidenceParser()
        parser.feed(body.decode(charset, errors="replace"))
        return {
            "body": body, "finalUrl": final_url, "httpStatus": response.status,
            "title": parser.title, "passages": parser.passages, "links": parser.links,
            "etag": response.headers.get("ETag"), "lastModified": response.headers.get("Last-Modified"),
        }


def normalize_site_link(base_url: str, href: str, approved_origin: tuple[str, str, int], path_prefix: str) -> str | None:
    if href.startswith(("mailto:", "tel:", "javascript:", "data:")):
        return None
    parsed = urlparse(urljoin(base_url, href))
    candidate = urlunparse((parsed.scheme, parsed.netloc, parsed.path or "/", "", "", ""))
    if origin(candidate) != approved_origin or not parsed.path.startswith(path_prefix):
        return None
    if posixpath.splitext(parsed.path.lower())[1] in IGNORED_EXTENSIONS:
        return None
    return candidate


def robots_policy(opener: Any, root_url: str, timeout: int) -> RobotFileParser:
    policy = RobotFileParser()
    robots_url = urljoin(root_url, "/robots.txt")
    policy.set_url(robots_url)
    try:
        response = opener.open(Request(robots_url, headers={"User-Agent": USER_AGENT}), timeout=timeout)
        with response:
            text = response.read(512_000).decode(response.headers.get_content_charset() or "utf-8", errors="replace")
        policy.parse(text.splitlines())
    except Exception:
        policy.parse([])
    return policy


def fetch_single(payload: dict[str, Any], max_bytes: int, timeout: int) -> dict[str, Any]:
    url = str(payload["url"])
    assert_public_https(url)
    headers: dict[str, str] = {}
    if payload.get("etag"):
        headers["If-None-Match"] = str(payload["etag"])
    if payload.get("lastModified"):
        headers["If-Modified-Since"] = str(payload["lastModified"])
    try:
        page = read_page(build_opener(SafeRedirectHandler(origin(url))), url, max_bytes, timeout, headers)
    except HTTPError as error:
        if error.code == 304:
            return {"status": "unchanged", "httpStatus": 304}
        raise
    excerpts = choose_evidence(page["passages"], list(payload.get("keywords", [])), 6000, 8)
    if not excerpts:
        raise ValueError("no useful text passages found")
    return {
        "status": "changed", "httpStatus": page["httpStatus"], "finalUrl": page["finalUrl"],
        "pageTitle": page["title"] or str(payload.get("name", "未命名来源")),
        "contentHash": hashlib.sha256(page["body"]).hexdigest(), "etag": page["etag"],
        "lastModified": page["lastModified"], "evidenceText": "\n\n".join(excerpts),
        "discoveredUrls": [page["finalUrl"]], "excerptCount": len(excerpts),
    }


def fetch_website(payload: dict[str, Any], max_bytes: int, timeout: int) -> dict[str, Any]:
    root_url = str(payload["url"])
    assert_public_https(root_url)
    approved_origin = origin(root_url)
    parsed_root = urlparse(root_url)
    root_path = parsed_root.path or "/"
    path_prefix = root_path if root_path.endswith("/") else root_path + "/"
    opener = build_opener(SafeRedirectHandler(approved_origin))
    policy = robots_policy(opener, root_url, timeout)
    max_pages = min(max(int(payload.get("maxPages", 8)), 1), 20)
    queue = [urlunparse((parsed_root.scheme, parsed_root.netloc, parsed_root.path or "/", "", "", ""))]
    queued = set(queue)
    visited: list[dict[str, Any]] = []

    while queue and len(visited) < max_pages:
        current = queue.pop(0)
        if not policy.can_fetch(USER_AGENT, current):
            if not visited:
                raise ValueError("robots.txt does not allow this website crawl")
            continue
        try:
            page = read_page(opener, current, max_bytes, timeout)
        except (HTTPError, ValueError):
            if not visited:
                raise
            continue
        if origin(page["finalUrl"]) != approved_origin:
            raise ValueError("website crawl left the approved host")
        visited.append(page)
        for href in page["links"]:
            candidate = normalize_site_link(page["finalUrl"], href, approved_origin, path_prefix)
            if candidate and candidate not in queued:
                queued.add(candidate)
                queue.append(candidate)
        if queue and len(visited) < max_pages:
            time.sleep(0.15)

    passages: list[str] = []
    for page in visited:
        passages.extend(f"来源页面：{page['finalUrl']}\n{text}" for text in page["passages"])
    excerpts = choose_evidence(passages, list(payload.get("keywords", [])), 6000)
    if not visited or not excerpts:
        raise ValueError("no useful website pages found")
    page_hashes = "\n".join(f"{page['finalUrl']}\t{hashlib.sha256(page['body']).hexdigest()}" for page in visited)
    return {
        "status": "changed", "httpStatus": visited[0]["httpStatus"], "finalUrl": visited[0]["finalUrl"],
        "pageTitle": f"{visited[0]['title'] or payload.get('name', '未命名站点')}（本次 {len(visited)} 页）",
        "contentHash": hashlib.sha256(page_hashes.encode("utf-8")).hexdigest(), "etag": None,
        "lastModified": None, "evidenceText": "\n\n".join(excerpts),
        "discoveredUrls": [page["finalUrl"] for page in visited], "excerptCount": len(excerpts),
    }


def fetch(payload: dict[str, Any]) -> dict[str, Any]:
    max_bytes = min(int(payload.get("maxBytes", 2_000_000)), 5_000_000)
    timeout = min(int(payload.get("timeoutSeconds", 20)), 60)
    if payload.get("crawlMode", "single_page") == "website":
        return fetch_website(payload, max_bytes, timeout)
    return fetch_single(payload, max_bytes, timeout)


def main() -> None:
    try:
        print(json.dumps(fetch(json.load(sys.stdin)), ensure_ascii=False))
    except Exception as error:
        print(json.dumps({"status": "failed", "error": str(error)}, ensure_ascii=False))
        raise SystemExit(1)


if __name__ == "__main__":
    main()
