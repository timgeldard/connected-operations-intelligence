#!/usr/bin/env python3
import json
import os


def convert_deps():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
    print(f"Scanning package.json files under {root_dir}")

    for root, dirs, files in os.walk(root_dir):
        # Prune node_modules and dist directories
        dirs[:] = [d for d in dirs if d not in ("node_modules", "dist", ".git")]

        for file in files:
            if file == "package.json":
                file_path = os.path.join(root, file)

                # Skip root package.json if it doesn't have local dependencies
                if file_path == os.path.join(root_dir, "package.json"):
                    continue

                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        data = json.load(f)

                    modified = False
                    for dep_type in ["dependencies", "devDependencies", "peerDependencies"]:
                        if dep_type in data and isinstance(data[dep_type], dict):
                            deps = data[dep_type]
                            for dep_name, dep_ver in list(deps.items()):
                                if dep_name.startswith("@connectio/"):
                                    if dep_ver == "*" or dep_ver.startswith("^0.1.0") or dep_ver == "0.1.0":
                                        deps[dep_name] = "workspace:*"
                                        modified = True
                                        print(f"  Updated dependency {dep_name} in {os.path.relpath(file_path, root_dir)}")

                    if modified:
                        with open(file_path, "w", encoding="utf-8") as f:
                            json.dump(data, f, indent=2)
                            f.write("\n")
                except Exception as exc:
                    print(f"Error processing {file_path}: {exc}")

if __name__ == "__main__":
    convert_deps()
