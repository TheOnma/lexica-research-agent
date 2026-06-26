#!/usr/bin/env python3
"""
Research-pipeline evaluation: citation grounding.

For each topic, discover papers and generate a recent-work summary, then check
that every bracketed citation [i] in the summary maps to a supplied reference —
i.e. the model never invents a citation. Mirrors run_evals.py's live-pipeline
style and requires network access + an Anthropic API key.

Usage:
    python evals/eval_research.py
    python evals/eval_research.py --topics "rag" "graph neural networks"
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from rag.pipelines.research import cited_indices, discover, summarize_recent_work  # noqa: E402
from rag.sources.base import Paper  # noqa: E402

DEFAULT_TOPICS = [
    "retrieval augmented generation",
    "graph neural networks for recommendation",
]


def score_grounding(summary: str, references: list[dict]) -> tuple[bool, str]:
    """Pass if every cited [i] maps to a supplied reference index."""
    valid = {r["index"] for r in references}
    cited = cited_indices(summary)
    invalid = cited - valid
    if invalid:
        return False, f"invalid citations {sorted(invalid)} (valid: {sorted(valid)})"
    return True, f"all {len(cited)} citations valid"


def run(topics: list[str], limit: int = 6) -> int:
    passed = 0
    for topic in topics:
        print(f"\n[{topic}]")
        papers = [Paper(**p) for p in discover(topic, limit=limit)["papers"]]
        out = summarize_recent_work(topic, papers)
        ok, detail = score_grounding(out["summary"], out["references"])
        print(f"  Papers: {len(papers)}  Grounding: {'PASS' if ok else 'FAIL'} — {detail}")
        passed += ok

    total = len(topics)
    print("\n" + "=" * 50)
    print(f"Citation grounding: {passed}/{total} topics passed")
    print("=" * 50)
    return 0 if passed == total else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate research-summary citation grounding")
    parser.add_argument("--topics", nargs="*", default=DEFAULT_TOPICS)
    parser.add_argument("--limit", type=int, default=6)
    args = parser.parse_args()
    sys.exit(run(args.topics, args.limit))
