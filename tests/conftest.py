import os
import tempfile
import urllib.error
import urllib.request

import pytest

pytest_plugins = ("gltest.fixtures",)


def pytest_configure(config):
    if not config.pluginmanager.hasplugin("gltest_direct"):
        config.pluginmanager.import_plugin("gltest.direct.pytest_plugin")


def _patch_gltest_release_fallback():
    import gltest.direct.sdk_loader as sdk_loader

    original_download_artifacts = sdk_loader.download_artifacts

    def download_artifacts_with_fallback(version: str):
        try:
            return original_download_artifacts(version)
        except urllib.error.HTTPError as error:
            if error.code != 404:
                raise

            sdk_loader.CACHE_DIR.mkdir(parents=True, exist_ok=True)
            tarball_name = f"genvm-universal-{version}.tar.xz"
            tarball_path = sdk_loader.CACHE_DIR / tarball_name
            fallback_url = f"{sdk_loader.GITHUB_RELEASES_URL}/download/{version}/genvm-runners-all.tar.xz"

            print(f"Falling back to {fallback_url}...")
            request = urllib.request.Request(fallback_url)
            request.add_header("User-Agent", "gltest-direct")

            with urllib.request.urlopen(request, timeout=300) as response:
                fd, temp_path = tempfile.mkstemp(dir=sdk_loader.CACHE_DIR)
                try:
                    with os.fdopen(fd, "wb") as tmp:
                        tmp.write(response.read())
                    os.replace(temp_path, tarball_path)
                except Exception:
                    if os.path.exists(temp_path):
                        os.unlink(temp_path)
                    raise

            return tarball_path

    sdk_loader.download_artifacts = download_artifacts_with_fallback


_patch_gltest_release_fallback()


@pytest.fixture(autouse=True)
def patch_gltest_windows_stdin(monkeypatch):
    if os.name != "nt":
        yield
        return

    import gltest.direct.loader as loader

    def _inject_message_to_fd0_windows_safe(vm):
        try:
            from genlayer.py import calldata
            from genlayer.py.types import Address
        except ImportError:
            return

        sender_addr = vm.sender
        if isinstance(sender_addr, bytes):
            sender_addr = Address(sender_addr)

        contract_addr = vm._contract_address
        if isinstance(contract_addr, bytes):
            contract_addr = Address(contract_addr)

        origin_addr = vm.origin
        if isinstance(origin_addr, bytes):
            origin_addr = Address(origin_addr)

        message_data = {
            "contract_address": contract_addr,
            "sender_address": sender_addr,
            "origin_address": origin_addr,
            "stack": [],
            "value": vm._value,
            "datetime": vm._datetime,
            "is_init": False,
            "chain_id": vm._chain_id,
            "entry_kind": 0,
            "entry_data": b"",
            "entry_stage_data": None,
        }

        encoded = calldata.encode(message_data)
        fd, path = tempfile.mkstemp()
        os.write(fd, encoded)
        os.lseek(fd, 0, os.SEEK_SET)
        vm._original_stdin_fd = os.dup(0)
        os.dup2(fd, 0)
        os.close(fd)
        vm._stdin_temp_path = path

    monkeypatch.setattr(loader, "_inject_message_to_fd0", _inject_message_to_fd0_windows_safe)
    yield
