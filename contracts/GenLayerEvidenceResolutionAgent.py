# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json
import typing


class GenLayerEvidenceResolutionAgent(gl.Contract):
    next_case_id: bigint
    case_count: bigint
    cases: TreeMap[bigint, str]

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

        self.cases[case_id] = json.dumps(record, sort_keys=True)
        self.next_case_id += 1
        self.case_count += 1
        return case_id

    @gl.public.write
    def resolve_case(self, case_id: bigint) -> typing.Any:
        record = self._get_case_record(case_id)

        if record["status"] == "RESOLVED":
            return json.dumps(record["resolution"], sort_keys=True)

        urls = record["evidence_urls"][:3]

        def get_input() -> str:
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

            return json.dumps(
                {
                    "title": record["title"],
                    "claim": record["claim"],
                    "criteria": record["criteria"],
                    "category": record["category"],
                    "evidence": evidence_snapshots,
                },
                sort_keys=True,
            )

        def leader_fn() -> str:
            adjudication_input = get_input()
            return gl.nondet.exec_prompt(
                f"""
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
            if not isinstance(leader_result, str):
                return False

            adjudication_input = get_input()
            verdict = gl.nondet.exec_prompt(
                f"""
                You are validating a leader-produced adjudication.
                Reply only true or false.

                Accept true only if:
                - the candidate output is valid minified JSON
                - verdict is exactly SUPPORTED, REFUTED, or INCONCLUSIVE
                - confidence is an integer from 0 to 100
                - rationale is grounded only in the supplied evidence
                - citations use only supplied URLs
                - the result meaningfully adjudicates the claim

                Input:
                {adjudication_input}

                Candidate output:
                {leader_result}
                """
            )
            return verdict.strip().lower() == "true"

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        parsed = json.loads(result) if isinstance(result, str) else result
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
        self.cases[case_id] = json.dumps(record, sort_keys=True)
        return json.dumps(resolution, sort_keys=True)

    @gl.public.view
    def get_case(self, case_id: bigint) -> str:
        return self.cases.get(case_id, "")

    @gl.public.view
    def get_case_count(self) -> bigint:
        return self.case_count

    @gl.public.view
    def get_cases_page(self, start: bigint, limit: bigint) -> str:
        rows = []
        upper = int(start + limit)
        for case_id in range(int(start), upper):
            case_json = self.cases.get(case_id, "")
            if case_json:
                rows.append(json.loads(case_json))
        return json.dumps(rows, sort_keys=True)

    def _get_case_record(self, case_id: bigint) -> dict:
        case_json = self.cases.get(case_id, "")
        if not case_json:
            raise gl.vm.UserError("Case not found.")
        return json.loads(case_json)
