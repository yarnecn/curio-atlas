from __future__ import annotations

import os
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from fetch_source import EvidenceParser, fetch, normalize_site_link, origin


class FixtureHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        pages = {
            '/robots.txt': ('text/plain', 'User-agent: *\nAllow: /\n'),
            '/science': ('text/html', '<title>科学入口</title><p>这是科学入口的有效证据段落，用于验证站点抓取。</p><a href="/science/next">下一页</a><a href="/other">越界页</a>'),
            '/science/next': ('text/html', '<title>科学下一页</title><p>这是同一目录下的第二段有效证据，用于验证页面发现。</p>'),
            '/other': ('text/html', '<title>不应抓取</title><p>这段内容位于允许目录以外，不应该进入抓取结果。</p>'),
        }
        content_type, body = pages.get(self.path, ('text/plain', 'not found'))
        encoded = body.encode('utf-8')
        self.send_response(200 if self.path in pages else 404)
        self.send_header('Content-Type', f'{content_type}; charset=utf-8')
        self.send_header('Content-Length', str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, format: str, *args: object) -> None:
        return


class CrawlerScopeTest(unittest.TestCase):
    def test_parser_collects_text_and_links(self) -> None:
        parser = EvidenceParser()
        parser.feed('<html><title>测试资料</title><p>这是一段足够长、可以作为证据候选的测试文字内容。</p><a href="/science/next">下一页</a></html>')
        self.assertEqual(parser.title, '测试资料')
        self.assertEqual(parser.links, ['/science/next'])
        self.assertEqual(len(parser.passages), 1)

    def test_website_scope_stays_on_host_and_path(self) -> None:
        approved = origin('https://example.org/science/')
        self.assertEqual(
            normalize_site_link('https://example.org/science/', 'next', approved, '/science/'),
            'https://example.org/science/next',
        )
        self.assertIsNone(normalize_site_link('https://example.org/science/', '/other', approved, '/science/'))
        self.assertIsNone(normalize_site_link('https://example.org/science/', 'https://other.example/science/', approved, '/science/'))
        self.assertIsNone(normalize_site_link('https://example.org/science/', 'report.pdf', approved, '/science/'))

    def test_directory_entry_without_trailing_slash_does_not_expand_to_whole_site(self) -> None:
        approved = origin('https://example.org/science')
        self.assertEqual(
            normalize_site_link('https://example.org/science', '/science/next', approved, '/science/'),
            'https://example.org/science/next',
        )
        self.assertIsNone(normalize_site_link('https://example.org/science', '/other', approved, '/science/'))

    def test_website_fetch_discovers_only_pages_below_the_approved_entry(self) -> None:
        server = ThreadingHTTPServer(('127.0.0.1', 0), FixtureHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        previous = os.environ.get('CRAWLER_ALLOW_HTTP')
        os.environ['CRAWLER_ALLOW_HTTP'] = 'true'
        try:
            result = fetch({
                'url': f'http://127.0.0.1:{server.server_port}/science',
                'name': '测试站点', 'crawlMode': 'website', 'maxPages': 5,
                'keywords': ['科学', '证据'], 'maxBytes': 100_000, 'timeoutSeconds': 5,
            })
            self.assertEqual(result['status'], 'changed')
            self.assertEqual(len(result['discoveredUrls']), 2)
            self.assertTrue(all('/science' in url for url in result['discoveredUrls']))
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)
            if previous is None:
                os.environ.pop('CRAWLER_ALLOW_HTTP', None)
            else:
                os.environ['CRAWLER_ALLOW_HTTP'] = previous


if __name__ == '__main__':
    unittest.main()
