import os
import tempfile

import pytest

pytest_plugins = ("gltest.fixtures",)


def pytest_configure(config):
    if not config.pluginmanager.hasplugin("gltest_direct"):
        config.pluginmanager.import_plugin("gltest.direct.pytest_plugin")


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
