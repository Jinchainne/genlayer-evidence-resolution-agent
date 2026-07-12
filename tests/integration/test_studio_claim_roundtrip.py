import json
import os

import pytest
from gltest import get_contract_factory, get_default_account, get_validator_factory
from gltest.types import MockedLLMResponse, MockedWebResponse, TransactionStatus


pytestmark = [pytest.mark.integration, pytest.mark.studio]


def require_studio_mode():
    if os.getenv("RUN_STUDIO_TESTS") != "1":
        pytest.skip("Set RUN_STUDIO_TESTS=1 and start GenLayer Studio or Localnet before running Studio Mode tests.")


def build_adjudication_input(title: str, claim: str, criteria: str, category: str, urls: list[str], bodies: dict[str, str]) -> str:
    return json.dumps(
        {
            "title": title,
            "claim": claim,
            "criteria": criteria,
            "category": category,
            "evidence": [{"url": url, "content": bodies[url][:6000]} for url in urls],
        },
        sort_keys=True,
    )


def build_leader_prompt(adjudication_input: str) -> str:
    return f"""
                Leader adjudication task.
                Review the claim against the supplied evidence snapshots.
                Return minified JSON with exactly these keys:
                verdict, confidence, rationale, citations.

                verdict must be one of:
                SUPPORTED, REFUTED, INCONCLUSIVE

                confidence must be an integer from 0 to 100.
                rationale must be a short explanation grounded only in the evidence.
                citations must be a JSON array of URLs chosen only from the supplied evidence URLs.

                Input:
                {adjudication_input}
                """


def build_validator_prompt(adjudication_input: str) -> str:
    return f"""
                Independent validator adjudication task.
                Review the same evidence and return your own minified JSON with exactly these keys:
                verdict, confidence, rationale, citations.

                verdict must be one of:
                SUPPORTED, REFUTED, INCONCLUSIVE

                confidence must be an integer from 0 to 100.
                rationale must be a short explanation grounded only in the evidence.
                citations must be a JSON array of URLs chosen only from the supplied evidence URLs.

                Input:
                {adjudication_input}
                """


def build_transaction_context(title: str, claim: str, criteria: str, category: str, urls: list[str], bodies: dict[str, str]):
    validator_factory = get_validator_factory()
    adjudication_input = build_adjudication_input(title, claim, criteria, category, urls, bodies)

    leader_response = json.dumps(
        {
            "verdict": "SUPPORTED",
            "confidence": 87,
            "rationale": "Primary and secondary evidence both support the infrastructure claim.",
            "citations": urls[:1],
        }
    )
    validator_response = json.dumps(
        {
            "verdict": "SUPPORTED",
            "confidence": 84,
            "rationale": "Independent validator reaches the same decision from the same sources.",
            "citations": urls[:1],
        }
    )

    mock_llm_response: MockedLLMResponse = {
        "nondet_exec_prompt": {
            build_leader_prompt(adjudication_input): leader_response,
            build_validator_prompt(adjudication_input): validator_response,
        }
    }
    mock_web_response: MockedWebResponse = {
        "nondet_web_request": {
            url: {
                "method": "GET",
                "status": 200,
                "body": bodies[url],
            }
            for url in urls
        }
    }

    validators = validator_factory.batch_create_mock_validators(
        count=5,
        mock_llm_response=mock_llm_response,
        mock_web_response=mock_web_response,
    )

    return {
        "validators": [validator.to_dict() for validator in validators],
        "genvm_datetime": "2026-07-12T10:00:00Z",
    }


def test_studio_claim_roundtrip():
    require_studio_mode()

    factory = get_contract_factory(contract_file_path="contracts/GenLayerEvidenceResolutionAgent.py")
    contract = factory.deploy(
        account=get_default_account(),
        wait_transaction_status=TransactionStatus.ACCEPTED,
        wait_interval=3000,
        wait_retries=120,
    )

    contract.create_case(
        [
            "Studio roundtrip claim",
            "GenLayer Studio integration is reachable and writable.",
            json.dumps(["https://example.com/studio"]),
            "SUPPORTED only if the transaction persists the claim record.",
            "Infrastructure",
        ]
    ).transact(
        wait_transaction_status=TransactionStatus.ACCEPTED,
        wait_interval=3000,
        wait_retries=120,
    )

    count = contract.get_case_count().call()
    assert int(count) >= 1

    stored = json.loads(contract.get_case([1]).call())
    assert stored["title"] == "Studio roundtrip claim"
    assert stored["status"] == "SUBMITTED"


def test_studio_resolve_case_with_mock_validators():
    require_studio_mode()

    title = "Studio resolve claim"
    claim = "The GenLayer local Studio can resolve a claim end-to-end."
    criteria = "SUPPORTED only if the evidence confirms the environment is reachable and the claim is stored."
    category = "Infrastructure"
    urls = ["https://example.com/studio", "https://example.com/status"]
    bodies = {
        "https://example.com/studio": "Studio endpoint is reachable and serving responses.",
        "https://example.com/status": "Status page confirms healthy infrastructure for the current run.",
    }

    transaction_context = build_transaction_context(title, claim, criteria, category, urls, bodies)

    factory = get_contract_factory(contract_file_path="contracts/GenLayerEvidenceResolutionAgent.py")
    contract = factory.deploy(
        account=get_default_account(),
        wait_transaction_status=TransactionStatus.ACCEPTED,
        wait_interval=3000,
        wait_retries=120,
    )

    contract.create_case(
        [title, claim, json.dumps(urls), criteria, category]
    ).transact(
        wait_transaction_status=TransactionStatus.ACCEPTED,
        wait_interval=3000,
        wait_retries=120,
    )

    contract.resolve_case([1]).transact(
        wait_transaction_status=TransactionStatus.ACCEPTED,
        wait_interval=3000,
        wait_retries=120,
        transaction_context=transaction_context,
    )

    stored = json.loads(contract.get_case([1]).call())
    assert stored["status"] == "RESOLVED"
    assert stored["resolution"]["verdict"] == "SUPPORTED"
    assert stored["resolution"]["citations"] == ["https://example.com/studio"]
