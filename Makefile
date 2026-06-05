.PHONY: install test lint typecheck contracts

install:
	pnpm install
	if [ ! -d .venv ]; then python3 -m venv .venv; fi
	.venv/bin/pip install -r data-products/io-reporting/tests/requirements-test.txt pyyaml

test:
	pnpm test
	PYTHONPATH=data-products/io-reporting .venv/bin/pytest data-products/io-reporting/tests

lint:
	pnpm lint
	.venv/bin/ruff check .

typecheck:
	pnpm typecheck

contracts:
	.venv/bin/python scripts/contracts/validate_contracts.py
	.venv/bin/python scripts/contracts/generate_contracts.py
