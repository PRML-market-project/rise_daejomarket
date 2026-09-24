"""Run once with network access. Normal server requests do not install models."""
import runtime  # Set paths before importing Argos.
from argostranslate import package
from packaging.version import Version


def install():
    installed = {(p.from_code, p.to_code) for p in package.get_installed_packages()}
    missing = [pair for pair in runtime.REQUIRED_PAIRS if pair not in installed]
    if missing:
        package.update_package_index()
        available = package.get_available_packages()
        for source, target in missing:
            candidates = [p for p in available if p.from_code == source and p.to_code == target]
            if not candidates:
                raise RuntimeError(f"No Argos model available for {source}->{target}")
            model = max(candidates, key=lambda p: Version(p.package_version))
            print(f"Installing {source}->{target} version {model.package_version}", flush=True)
            package.install_from_path(model.download())
    # Warm sentence splitters too, so their assets are downloaded during setup.
    from engine import ArgosEngine
    engine = ArgosEngine(allow_download=True)
    print(engine.translate("김치를 판매합니다.", "ko", ["en", "vi"]), flush=True)
    print("Models ready. Start the server with python server.py", flush=True)


if __name__ == "__main__":
    install()
