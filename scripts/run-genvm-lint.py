import os
import shutil
import subprocess
import sys
from pathlib import Path


def resolve_cli() -> str:
    direct = shutil.which("genvm-lint")
    if direct:
        return direct

    user_scripts = Path(os.environ.get("APPDATA", "")) / "Python" / f"Python{sys.version_info.major}{sys.version_info.minor}" / "Scripts" / "genvm-lint.exe"
    if user_scripts.exists():
        return str(user_scripts)

    raise SystemExit(
        "genvm-lint was not found on PATH. Install it with `pip install genvm-linter` "
        "or ensure your Python Scripts directory is available."
    )


def main() -> int:
    cli = resolve_cli()
    env = os.environ.copy()
    env.setdefault("PYTHONIOENCODING", "utf-8")
    command = [cli, *sys.argv[1:]]
    return subprocess.call(command, env=env)


if __name__ == "__main__":
    raise SystemExit(main())
