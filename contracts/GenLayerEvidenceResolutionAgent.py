# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json
import typing


class GenLayerEvidenceResolutionAgent(gl.Contract):
    next_case_id: bigint
    case_count: bigint
    cases: TreeMap[str, str]

    def __init__(self):
        self.next_case_id = 1
        self.case_count = 0
        self.cases = TreeMap()

    @gl.public.write
    def create_case(
        self,
        title: str,
        claim: str,
        evidence_urls_json: str,
        criteria: str,
        category: str,
    ) -> bigint:
        evidence_urls = json.loads(evidence_urls_json)
        case_id = self.next_case_id

        record = {
            "id": case_id,
            "title": title,
            "claim": claim,
            "criteria": criteria,
            "category": category,
            "status": "SUBMITTED",
            "evidence_urls": evidence_urls[:3],
            "created_at": str(gl.message_raw["datetime"]),
            "submitter": str(gl.message.sender_address),
            "resolution": None,
        }

        self.cases[self._case_key(case_id)] = json.dumps(record, sort_keys=True)
        self.next_case_id += 1
        self.case_count += 1
        return case_id

    @gl.public.write
    def resolve_case(self, case_id: bigint) -> typing.Any:
        record = self._get_case_record(case_id)

        if record["status"] == "RESOLVED":
            return json.dumps(record["resolution"], sort_keys=True)

        urls = record["evidence_urls"][:3]

        def parse_candidate(raw_candidate):
            payload = raw_candidate.calldata if hasattr(raw_candidate, "calldata") else raw_candidate
            parsed = json.loads(payload) if isinstance(payload, str) else payload
            if not isinstance(parsed, dict):
                return None

            verdict = str(parsed.get("verdict", "")).upper()
            if verdict not in ("SUPPORTED", "REFUTED", "INCONCLUSIVE"):
                return None

            try:
                confidence = int(parsed.get("confidence", 0))
            except (TypeError, ValueError):
                return None

            if confidence < 0 or confidence > 100:
                return None

            citations = parsed.get("citations", [])
            if not isinstance(citations, list):
                return None

            filtered_citations = [url for url in citations if isinstance(url, str) and url in urls]

            return {
                "verdict": verdict,
                "confidence": confidence,
                "rationale": str(parsed.get("rationale", "")),
                "citations": filtered_citations,
            }

        def leader_fn() -> str:
            evidence_snapshots = []
            for url in urls:
                response = gl.nondet.web.get(url)
                body = response.body.decode("utf-8")
                evidence_snapshots.append(
                    {
                        "url": url,
                        "content": body[:6000],
                    }
                )

            adjudication_input = json.dumps(
                {
                    "title": record["title"],
                    "claim": record["claim"],
                    "criteria": record["criteria"],
                    "category": record["category"],
                    "evidence": evidence_snapshots,
                },
                sort_keys=True,
            )
            return gl.nondet.exec_prompt(
                f"""
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
            )

        def validator_fn(leader_result) -> bool:
            leader_candidate = parse_candidate(leader_result)
            if leader_candidate is None:
                return False

            evidence_snapshots = []
            for url in urls:
                response = gl.nondet.web.get(url)
                body = response.body.decode("utf-8")
                evidence_snapshots.append(
                    {
                        "url": url,
                        "content": body[:6000],
                    }
                )

            adjudication_input = json.dumps(
                {
                    "title": record["title"],
                    "claim": record["claim"],
                    "criteria": record["criteria"],
                    "category": record["category"],
                    "evidence": evidence_snapshots,
                },
                sort_keys=True,
            )
            validator_raw = gl.nondet.exec_prompt(
                f"""
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
            )
            validator_candidate = parse_candidate(validator_raw)
            if validator_candidate is None:
                return False

            if leader_candidate["verdict"] != validator_candidate["verdict"]:
                return False

            if abs(leader_candidate["confidence"] - validator_candidate["confidence"]) > 15:
                return False

            if leader_candidate["verdict"] != "INCONCLUSIVE":
                leader_citations = set(leader_candidate["citations"])
                validator_citations = set(validator_candidate["citations"])
                if not leader_citations:
                    return False
                if validator_citations and not (leader_citations & validator_citations):
                    return False

            return True

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        parsed = parse_candidate(result)
        if parsed is None:
            raise gl.vm.UserError("Consensus result could not be parsed into a valid adjudication payload.")
        resolution = {
            "verdict": parsed.get("verdict", "INCONCLUSIVE"),
            "confidence": int(parsed.get("confidence", 0)),
            "rationale": str(parsed.get("rationale", "")),
            "citations": [url for url in parsed.get("citations", []) if url in urls],
            "resolver": str(gl.message.sender_address),
            "resolved_at": str(gl.message_raw["datetime"]),
        }

        record["status"] = "RESOLVED"
        record["resolution"] = resolution
        self.cases[self._case_key(case_id)] = json.dumps(record, sort_keys=True)
        return json.dumps(resolution, sort_keys=True)

    @gl.public.view
    def get_case(self, case_id: bigint) -> str:
        return self.cases.get(self._case_key(case_id), "")

    @gl.public.view
    def get_case_count(self) -> bigint:
        return self.case_count

    @gl.public.view
    def get_cases_page(self, start: bigint, limit: bigint) -> str:
        rows = []
        upper = int(start + limit)
        for case_id in range(int(start), upper):
            case_json = self.cases.get(self._case_key(case_id), "")
            if case_json:
                rows.append(json.loads(case_json))
        return json.dumps(rows, sort_keys=True)

    def _get_case_record(self, case_id: bigint) -> dict:
        case_json = self.cases.get(self._case_key(case_id), "")
        if not case_json:
            raise gl.vm.UserError("Case not found.")
        return json.loads(case_json)

    def _case_key(self, case_id: bigint) -> str:
        return str(case_id)
