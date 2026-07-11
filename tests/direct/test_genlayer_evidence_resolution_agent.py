import json


def test_create_case_stores_record(direct_deploy):
    contract = direct_deploy("contracts/GenLayerEvidenceResolutionAgent.py")

    case_id = contract.create_case(
        "Rumor check",
        "Token XYZ was listed by a major exchange.",
        json.dumps(["https://example.com/a", "https://example.com/b"]),
        "SUPPORTED only with direct confirmation.",
        "Market Integrity",
    )

    assert case_id == 1
    assert contract.get_case_count() == 1

    record = json.loads(contract.get_case(1))
    assert record["status"] == "SUBMITTED"
    assert record["title"] == "Rumor check"
    assert record["evidence_urls"] == ["https://example.com/a", "https://example.com/b"]


def test_resolve_case_persists_verdict_and_filters_citations(direct_vm, direct_deploy):
    contract = direct_deploy("contracts/GenLayerEvidenceResolutionAgent.py")

    direct_vm.mock_web(r"example\.com/a", {"status": 200, "body": "primary source says listed"})
    direct_vm.mock_web(r"example\.com/b", {"status": 200, "body": "secondary source agrees"})
    direct_vm.mock_llm(
        r".*Return minified JSON.*",
        json.dumps(
            {
                "verdict": "SUPPORTED",
                "confidence": 88,
                "rationale": "Two evidence sources support the listing claim.",
                "citations": ["https://example.com/a", "https://example.com/ignored"],
            }
        ),
    )
    direct_vm.mock_llm(r".*Reply only true or false.*", "true")

    contract.create_case(
        "Listing",
        "XYZ has been listed.",
        json.dumps(["https://example.com/a", "https://example.com/b"]),
        "Only support if sources confirm.",
        "Market Integrity",
    )

    result = json.loads(contract.resolve_case(1))
    assert result["verdict"] == "SUPPORTED"
    assert result["confidence"] == 88
    assert result["citations"] == ["https://example.com/a"]

    stored = json.loads(contract.get_case(1))
    assert stored["status"] == "RESOLVED"
    assert stored["resolution"]["verdict"] == "SUPPORTED"


def test_validator_disagrees_on_meaningfully_different_output(direct_vm, direct_deploy):
    contract = direct_deploy("contracts/GenLayerEvidenceResolutionAgent.py")

    contract.create_case(
        "Exploit claim",
        "Protocol ABC has been exploited.",
        json.dumps(["https://example.com/security"]),
        "REFUTED if evidence shows a false alarm.",
        "Security",
    )

    direct_vm.mock_web(r"example\.com/security", {"status": 200, "body": "incident report text"})
    direct_vm.mock_llm(
        r".*Return minified JSON.*",
        json.dumps(
            {
                "verdict": "REFUTED",
                "confidence": 82,
                "rationale": "Evidence indicates a false alarm.",
                "citations": ["https://example.com/security"],
            }
        ),
    )
    direct_vm.mock_llm(r".*Reply only true or false.*", "true")

    contract.resolve_case(1)

    direct_vm.clear_mocks()
    direct_vm.mock_web(r"example\.com/security", {"status": 200, "body": "incident report text"})
    direct_vm.mock_llm(r".*Reply only true or false.*", "false")

    assert direct_vm.run_validator() is False
