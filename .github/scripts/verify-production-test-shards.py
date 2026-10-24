"""Observe native Node sharding; do not schedule, replace or reinterpret tests."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import xml.etree.ElementTree as ET

SCHEMA = "production-boundary-shard.v1"
TOTAL = 19
EXPECTED_COUNT = 381
OUTPUT = ".vercel/private/production-boundary-unit-shard"
DOWNLOADS = ".vercel/private/production-boundary-unit-artifacts"
MANIFEST_KEYS = {"schema", "head", "runId", "runAttempt", "shard", "total", "nodeVersion", "files"}
RECEIPT_KEYS = {"entry", "pid", "sourceSha256", "startedAt", "exitCode"}
HEX = re.compile(r"[0-9a-f]{64}\Z")
TIME = re.compile(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z\Z")
RECEIPT_NAME = re.compile(r"entry-([1-9][0-9]*)-([0-9a-f]{64})\.(start|exit)\.json\Z")


class Denied(Exception):
    def __init__(self, code):
        self.code = code
        super().__init__(code)


def need(condition, code):
    if not condition:
        raise Denied(code)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        need(key not in result, "JSON_DUPLICATE_KEY")
        result[key] = value
    return result


def read_json(file):
    need(file.is_file() and not file.is_symlink(), "EVIDENCE_FILE")
    need(file.stat().st_size <= 262144, "EVIDENCE_SIZE")
    try:
        return json.loads(file.read_text(encoding="utf-8"), object_pairs_hook=unique_object,
                          parse_constant=lambda _: (_ for _ in ()).throw(Denied("JSON_CONSTANT")))
    except (ValueError, UnicodeError):
        raise Denied("JSON_INVALID") from None


def exact_keys(value, keys, code):
    need(type(value) is dict and set(value) == keys, code)


def node_version():
    value = subprocess.check_output(["node", "--version"], text=True).strip()
    need(re.fullmatch(r"v24\.\d+\.\d+", value) is not None, "NODE_VERSION")
    return value


def production_context(root, environ):
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
    need(re.fullmatch(r"[0-9a-f]{40}", head) is not None and head == environ.get("GITHUB_SHA"), "HEAD")
    run_id, attempt = environ.get("GITHUB_RUN_ID", ""), environ.get("GITHUB_RUN_ATTEMPT", "")
    need(re.fullmatch(r"[1-9][0-9]*", run_id) is not None and re.fullmatch(r"[1-9][0-9]*", attempt) is not None, "RUN_ID")
    tracked = subprocess.check_output(["git", "ls-files", "-z", "--", "tests/production-*.test.mjs"], cwd=root).decode().split("\0")
    entries = sorted(entry for entry in tracked if entry)
    need(len(entries) == EXPECTED_COUNT and all(re.fullmatch(r"tests/production-[^/]+\.test\.mjs", entry) for entry in entries), "INVENTORY_COUNT")
    disk = sorted(file.relative_to(root).as_posix() for file in (root / "tests").glob("production-*.test.mjs"))
    need(entries == disk, "INVENTORY_DISK")
    changed = subprocess.run(["git", "diff", "--quiet", "HEAD", "--", "tests/production-*.test.mjs"], cwd=root, check=False)
    need(changed.returncode == 0, "INVENTORY_CHANGED")
    files = []
    for entry in entries:
        file = root / entry
        need(file.is_file() and not file.is_symlink(), "SOURCE_FILE")
        files.append({"entry": entry, "sourceSha256": digest(file.read_bytes())})
    return {"head": head, "runId": run_id, "runAttempt": attempt, "nodeVersion": node_version(), "files": files}


def prepare(root, environ):
    context = production_context(root, environ)
    shard = environ.get("BOUNDARY_UNIT_SHARD", "")
    need(shard in {str(index) for index in range(1, TOTAL + 1)}, "SHARD_ID")
    relative = environ.get("BOUNDARY_UNIT_OUTPUT", OUTPUT)
    need(relative == OUTPUT, "OUTPUT_SCOPE")
    output = root / relative
    output.mkdir(parents=True, exist_ok=False)
    (output / "entries").mkdir()
    manifest = {"schema": SCHEMA, **context, "shard": int(shard), "total": TOTAL}
    with (output / "manifest.json").open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(manifest, handle, separators=(",", ":"))
        handle.write("\n")
    return {"ok": True, "prepared": EXPECTED_COUNT, "shard": int(shard), "total": TOTAL}


def validate_junit(file):
    need(file.is_file() and not file.is_symlink(), "JUNIT_FILE")
    need(file.stat().st_size <= 33554432, "JUNIT_SIZE")
    raw = file.read_bytes()
    need(b"<!DOCTYPE" not in raw and b"<!ENTITY" not in raw, "JUNIT_ENTITY")
    try:
        tree = ET.fromstring(raw)
    except ET.ParseError:
        raise Denied("JUNIT_INVALID") from None
    need(tree.tag == "testsuites" and len(list(tree.iter("testcase"))) > 0, "JUNIT_SHAPE")
    need(not list(tree.iter("failure")) and not list(tree.iter("error")), "JUNIT_FAILURE")
    need(all(suite.get("failures", "0") == "0" and suite.get("errors", "0") == "0"
             for suite in tree.iter("testsuite")), "JUNIT_FAILURE")


def artifact_name(context, shard):
    return f"production-unit-{context['runId']}-{context['runAttempt']}-{shard}"


def validate_evidence(downloads, expected):
    """Pure evidence validation. CLI supplies its fresh exact381 Git context."""
    need(downloads.is_dir() and not downloads.is_symlink(), "ARTIFACT_ROOT")
    names = {artifact_name(expected, shard) for shard in range(1, TOTAL + 1)}
    need({file.name for file in downloads.iterdir()} == names, "ARTIFACT_SET")
    expected_files = expected["files"]
    source_by_entry = {file["entry"]: file["sourceSha256"] for file in expected_files}
    need(len(source_by_entry) == len(expected_files), "EXPECTED_DUPLICATE")
    seen = set()
    for shard in range(1, TOTAL + 1):
        artifact = downloads / artifact_name(expected, shard)
        need(artifact.is_dir() and not artifact.is_symlink(), "ARTIFACT_DIRECTORY")
        need({file.name for file in artifact.iterdir()} == {"manifest.json", "native.junit.xml", "entries"}, "ARTIFACT_CONTENTS")
        manifest = read_json(artifact / "manifest.json")
        exact_keys(manifest, MANIFEST_KEYS, "MANIFEST_SHAPE")
        need(manifest["schema"] == SCHEMA and type(manifest["shard"]) is int and manifest["shard"] == shard
             and type(manifest["total"]) is int and manifest["total"] == TOTAL, "MANIFEST_SHARD")
        for key in ("head", "runId", "runAttempt", "nodeVersion"):
            need(manifest[key] == expected[key], "MANIFEST_" + key.upper())
        need(manifest["files"] == expected_files, "MANIFEST_FILES")
        entries_dir = artifact / "entries"
        need(entries_dir.is_dir() and not entries_dir.is_symlink(), "ENTRIES_DIRECTORY")
        pairs = {}
        for file in entries_dir.iterdir():
            match = RECEIPT_NAME.fullmatch(file.name)
            need(match is not None, "ENTRY_FILENAME")
            receipt = read_json(file)
            exact_keys(receipt, RECEIPT_KEYS, "ENTRY_SHAPE")
            entry, pid = receipt["entry"], receipt["pid"]
            need(type(entry) is str and entry in source_by_entry, "ENTRY_EXTRA")
            need(type(pid) is int and pid > 0 and str(pid) == match[1], "ENTRY_PID")
            need(digest(entry.encode()) == match[2], "ENTRY_PATH_ID")
            need(type(receipt["sourceSha256"]) is str and HEX.fullmatch(receipt["sourceSha256"])
                 and receipt["sourceSha256"] == source_by_entry[entry], "ENTRY_SOURCE")
            need(type(receipt["startedAt"]) is str and TIME.fullmatch(receipt["startedAt"]), "ENTRY_TIME")
            if match[3] == "start":
                need(receipt["exitCode"] is None, "ENTRY_START")
            else:
                need(type(receipt["exitCode"]) is int and receipt["exitCode"] == 0, "ENTRY_EXIT")
            key = (entry, pid)
            pair = pairs.setdefault(key, {})
            need(match[3] not in pair, "ENTRY_DUPLICATE_RECEIPT")
            pair[match[3]] = receipt
        need(len(pairs) > 0, "SHARD_EMPTY")
        for (entry, _), pair in pairs.items():
            need(set(pair) == {"start", "exit"}, "ENTRY_PAIR")
            need({key: value for key, value in pair["start"].items() if key != "exitCode"}
                 == {key: value for key, value in pair["exit"].items() if key != "exitCode"}, "ENTRY_PAIR")
            need(entry not in seen, "ENTRY_DUPLICATE")
            seen.add(entry)
        validate_junit(artifact / "native.junit.xml")
    need(seen == set(source_by_entry), "ENTRY_MISSING")
    return {"ok": True, "shards": TOTAL, "entries": len(seen), "disjoint": True}


def main():
    need(len(sys.argv) == 2 and sys.argv[1] in {"prepare", "verify"}, "COMMAND")
    root = Path.cwd()
    if sys.argv[1] == "prepare":
        return prepare(root, os.environ)
    expected = production_context(root, os.environ)
    result = validate_evidence(root / DOWNLOADS, expected)
    need(production_context(root, os.environ) == expected, "SOURCE_CHANGED_DURING_VERIFY")
    return result


if __name__ == "__main__":
    try:
        print(json.dumps(main(), separators=(",", ":")))
    except Denied as denied:
        print(json.dumps({"ok": False, "code": denied.code}), file=sys.stderr)
        sys.exit(1)
