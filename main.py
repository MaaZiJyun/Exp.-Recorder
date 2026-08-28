"""Main entry point for Exp.-Recorder Application."""

import os
import sys
import warnings

# Suppress macOS Tk deprecation warning and pyvisa discovery warnings
os.environ["TK_SILENCE_DEPRECATION"] = "1"
warnings.filterwarnings("ignore", category=UserWarning)

import argparse
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S"
)


def main():
    parser = argparse.ArgumentParser(description="Exp.-Recorder | 实验自动化控制系统")
    parser.add_argument("--cli", action="store_true", help="Launch interactive CLI mode instead of the web API")
    parser.add_argument("--mock", action="store_true", help="Run with simulated hardware (for testing/development)")
    parser.add_argument("--host", default="127.0.0.1", help="Web API listen address")
    parser.add_argument("--port", type=int, default=8000, help="Web API listen port")
    args = parser.parse_args()

    if args.cli:
        from src.ui.cli import ExperimentCLI
        app = ExperimentCLI(mock=args.mock)
        app.main_menu()
    else:
        import uvicorn
        from src.api.server import create_app

        uvicorn.run(create_app(mock=args.mock), host=args.host, port=args.port)


if __name__ == "__main__":
    main()
