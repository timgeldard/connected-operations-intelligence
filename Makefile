.PHONY: install test lint typecheck contracts

install:
	pnpm install
	if [ ! -d .venv ]; then python3 -m venv .venv; fi
	.venv/bin/pip install -r data-products/io-reporting/tests/requirements-test.txt pyyaml

test:
	pnpm test
	.venv/bin/pytest

lint:
	pnpm lint
	.venv/bin/ruff check .

typecheck:
	pnpm typecheck

contracts:
	@if [ -f scripts/contracts/validate_contracts.py ]; then .venv/bin/python scripts/contracts/validate_contracts.py; fi
	@if [ -f scripts/contracts/generate_contracts.py ]; then .venv/bin/python scripts/contracts/generate_contracts.py; fi
