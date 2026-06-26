"""
Unit tests for the research pipeline.

Network (arXiv / Semantic Scholar) and the LLM are mocked, so these run without
hitting external services. Focus: source de-duplication/merging and the
citation-grounding guard (no summary may cite a reference that wasn't supplied).
"""

import rag.pipelines.research as research
import rag.sources as sources
from rag.sources.base import Paper


def _paper(**kw) -> Paper:
    base = dict(
        id="x", title="T", authors=["A"], year=2024, abstract="abstract",
        url="http://x", source="arxiv", pdf_url=None, citation_count=0, external_ids={},
    )
    base.update(kw)
    return Paper(**base)


def test_dedup_key_normalizes_arxiv_version():
    a = _paper(id="2304.01234v2", external_ids={"ArXiv": "2304.01234v2"})
    b = _paper(id="2304.01234", external_ids={"ArXiv": "2304.01234"})
    assert a.dedup_key == b.dedup_key


def test_find_papers_dedupes_and_merges_across_sources(monkeypatch):
    arxiv_hit = _paper(
        title="Retrieval Augmented Generation", source="arxiv",
        pdf_url="http://pdf", external_ids={"ArXiv": "2005.11401"}, citation_count=0,
    )
    s2_hit = _paper(
        title="Retrieval-Augmented Generation!", source="semantic_scholar",
        pdf_url=None, external_ids={"ArXiv": "2005.11401", "DOI": "10.1/x"}, citation_count=900,
    )
    monkeypatch.setattr(sources.arxiv, "search_arxiv", lambda topic, max_results: [arxiv_hit])
    monkeypatch.setattr(sources.semantic_scholar, "search_papers", lambda topic, limit: [s2_hit])

    result = sources.find_papers("rag", limit=10)

    assert len(result) == 1                       # the two records collapsed into one
    merged = result[0]
    assert merged.pdf_url == "http://pdf"         # arXiv PDF kept
    assert merged.citation_count == 900           # S2 citation count merged in
    assert merged.external_ids.get("DOI") == "10.1/x"


def test_find_papers_survives_one_source_failing(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("S2 down")

    monkeypatch.setattr(sources.arxiv, "search_arxiv", lambda topic, max_results: [_paper(title="ok")])
    monkeypatch.setattr(sources.semantic_scholar, "search_papers", boom)

    result = sources.find_papers("rag", limit=10)
    assert len(result) == 1


def test_cited_indices_parses_grouped_citations():
    assert research.cited_indices("Foo [1]. Bar [2, 3] and [10].") == {1, 2, 3, 10}


def test_summary_only_cites_supplied_papers(monkeypatch):
    papers = [_paper(title="P1"), _paper(title="P2")]
    # Mock the LLM: a well-behaved summary cites only [1] and [2].
    monkeypatch.setattr(research, "complete", lambda *a, **k: "P1 did X [1]; P2 did Y [2].")

    out = research.summarize_recent_work("topic", papers)

    ref_indices = {r["index"] for r in out["references"]}
    assert ref_indices == {1, 2}
    # Grounding guard: every cited index maps to a supplied reference.
    assert research.cited_indices(out["summary"]) <= ref_indices


def test_summary_handles_no_papers():
    out = research.summarize_recent_work("topic", [])
    assert out["references"] == []
    assert research.cited_indices(out["summary"]) == set()
