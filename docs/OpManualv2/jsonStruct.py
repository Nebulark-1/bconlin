import json
from datetime import datetime

# Path to your manual
json_path = "manual.json"

# Today's date
today = datetime.now().strftime("%Y-%m-%d")

# Define required structure
required_fields = {
    "title": "",
    "tags": [],
    "content": "",
    "lastEdited": today,
    "subsections": []
}

# Recursively apply structure
def enforce_structure(section):
    # Add missing fields
    for key, default in required_fields.items():
        if key not in section:
            section[key] = default
        elif key == "lastEdited" and not section[key]:
            section[key] = today

    # Recursively apply to subsections
    for sub in section.get("subsections", []):
        enforce_structure(sub)

# Load the JSON file
with open(json_path, "r", encoding="utf-8") as f:
    data = json.load(f)

# Wrap root if needed
manual = {"subsections": [data]} if "subsections" not in data else data

# Apply recursively
for top_section in manual["subsections"]:
    enforce_structure(top_section)

# Save updated file
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(manual["subsections"][0] if "subsections" in manual and len(manual["subsections"]) == 1 else manual, f, indent=4)

print("✅ JSON updated with missing fields and lastEdited dates.")
