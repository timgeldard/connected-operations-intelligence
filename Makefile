.PHONY: install test lint typecheck contracts prep-app-deploy generate-okf

install:
	pnpm install
	if [ ! -d .venv ]; then python3 -m venv .venv; fi
	.venv/bin/pip install -r data-products/io-reporting/tests/requirements-test.txt pyyaml

test:
	pnpm test
	PYTHONPATH=data-products/io-reporting .venv/bin/pytest --import-mode=importlib data-products/io-reporting/tests

lint:
	pnpm lint
	.venv/bin/ruff check .

typecheck:
	pnpm typecheck

contracts:
	.venv/bin/python scripts/contracts/validate_contracts.py
	.venv/bin/python scripts/contracts/generate_contracts.py

# Regenerate the OKF bundle from the single source-of-truth contract manifest.
# Run this whenever app_contract_manifest.yml changes or the governed surface changes.
# CI (scripts/ci/check_okf_bundle_fresh.py) blocks merges where the committed bundle
# is out of sync with the manifest.
generate-okf:
	python3 data-products/io-reporting/scripts/generate_okf_bundle.py

# Prepare the deploy artefact: copy the single source-of-truth contract manifest
# from the data-products layer into apps/api/contracts/ so that `databricks bundle
# deploy` can upload it.  This file is gitignored (it is NOT the source of truth);
# the root databricks.yml carries an explicit `sync.include` that overrides the
# .gitignore so the copied file is synced to the workspace.
# Run this step BEFORE `databricks bundle deploy`.
prep-app-deploy:
	cp data-products/io-reporting/contracts/app_contract_manifest.yml apps/api/contracts/app_contract_manifest.yml
	@echo "Manifest copied to apps/api/contracts/ — ready for bundle deploy."
