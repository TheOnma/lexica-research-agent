"""
Unit tests for the arXiv PDF download (rag.sources.arxiv.download_pdf).

Network is mocked. arXiv >= 4.0 removed the library's download helpers, so we
download the PDF directly over HTTP — these tests pin that behavior, including
the fallback URL built from the arXiv id when pdf_url is missing.
"""

from rag.sources.arxiv import download_pdf
from rag.sources.base import Paper


class FakeResponse:
    def __init__(self, content=b"%PDF-fake", status=200):
        self.content = content
        self.status_code = status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


def _paper(**kw) -> Paper:
    base = dict(
        id="2512.22199v1",
        title="Bidirectional RAG",
        authors=["A"],
        year=2025,
        abstract="abstract",
        url="http://arxiv.org/abs/2512.22199v1",
        source="arxiv",
        pdf_url="https://arxiv.org/pdf/2512.22199v1",
        external_ids={"ArXiv": "2512.22199v1"},
    )
    base.update(kw)
    return Paper(**base)


def test_download_pdf_writes_bytes_from_pdf_url(monkeypatch, tmp_path):
    captured = {}

    def fake_get(url, **kwargs):
        captured["url"] = url
        captured["kwargs"] = kwargs
        return FakeResponse(content=b"%PDF-1.7 fake content")

    monkeypatch.setattr("rag.sources.arxiv.requests.get", fake_get)

    path = download_pdf(_paper())
    assert path.read_bytes() == b"%PDF-1.7 fake content"
    assert path.name == "2512.22199v1.pdf"
    assert captured["url"] == "https://arxiv.org/pdf/2512.22199v1"
    assert "User-Agent" in captured["kwargs"]["headers"]
    assert captured["kwargs"]["timeout"] == 60


def test_download_pdf_falls_back_to_id_built_url(monkeypatch):
    captured = {}

    def fake_get(url, **kwargs):
        captured["url"] = url
        return FakeResponse(content=b"%PDF")

    monkeypatch.setattr("rag.sources.arxiv.requests.get", fake_get)

    paper = _paper(pdf_url=None)
    path = download_pdf(paper)
    assert path.read_bytes() == b"%PDF"
    assert captured["url"] == "https://arxiv.org/pdf/2512.22199v1"


def test_download_pdf_raises_on_http_error(monkeypatch):
    def fake_get(url, **kwargs):
        return FakeResponse(status=404)

    monkeypatch.setattr("rag.sources.arxiv.requests.get", fake_get)

    try:
        download_pdf(_paper())
    except RuntimeError as e:
        assert "HTTP 404" in str(e)
    else:
        raise AssertionError("expected RuntimeError for HTTP 404")
