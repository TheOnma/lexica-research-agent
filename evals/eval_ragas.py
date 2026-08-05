"""RAGAS Evaluation Script.

This script evaluates our RAG pipeline using Ragas metrics.
We score the pipeline on:
1. Faithfulness: Is the answer derived from the given context, or did the LLM hallucinate?
2. Context Precision: Did we retrieve the right chunks and rank them highly?
3. Answer Relevance: Does the generated answer address the actual question asked?
"""

import os
import sys
import logging
from pathlib import Path

# Add the parent directory to the path so we can import rag modules
sys.path.append(str(Path(__file__).resolve().parent.parent))

from datasets import Dataset
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevance, context_precision
from langchain_anthropic import ChatAnthropic
from langchain_openai import OpenAIEmbeddings

from rag.pipelines.rag import answer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_evaluation():
    # 1. Define a test dataset. In a real scenario, this would be loaded from a JSON/CSV.
    # We define a few questions that our RAG system should be able to answer.
    # Note: You should ingest a sample document first before running this!
    test_questions = [
        {
            "question": "What is the main topic of the document?",
            "ground_truth": "The main topic is Retrieval-Augmented Generation." # Update this to match your ingested doc
        }
    ]

    logger.info("Generating answers for evaluation dataset...")
    
    data_samples = {
        "question": [],
        "answer": [],
        "contexts": [],
        "ground_truth": []
    }

    for item in test_questions:
        q = item["question"]
        # Run our RAG pipeline!
        result = answer(q)
        
        # Extract the texts from the retrieved sources
        contexts = [source["text"] for source in result.get("sources", [])] if "sources" in result else []
        
        data_samples["question"].append(q)
        data_samples["answer"].append(result["answer"])
        data_samples["contexts"].append(contexts)
        data_samples["ground_truth"].append(item["ground_truth"])

    dataset = Dataset.from_dict(data_samples)

    # 2. Configure RAGAS models. Ragas uses Langchain under the hood.
    # We use Claude for generating the evaluation scores, and OpenAI for embedding-based metrics.
    eval_llm = ChatAnthropic(model="claude-3-haiku-20240307")
    eval_embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

    # 3. Run the evaluation
    logger.info("Running RAGAS evaluation...")
    result = evaluate(
        dataset=dataset,
        metrics=[
            faithfulness,
            answer_relevance,
            context_precision,
        ],
        llm=eval_llm,
        embeddings=eval_embeddings,
    )

    logger.info("Evaluation Complete!")
    print("\n--- RAGAS Scores ---")
    print(result)
    
if __name__ == "__main__":
    # Ensure API keys are present (usually loaded via dotenv, but let's double check)
    if not os.getenv("ANTHROPIC_API_KEY") or not os.getenv("OPENAI_API_KEY"):
        logger.error("Missing ANTHROPIC_API_KEY or OPENAI_API_KEY in environment.")
        sys.exit(1)
        
    run_evaluation()
