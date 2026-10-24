
import json
import os
import hashlib
from subnexa_auth import current_user_sub

SAVE_FOLDER = "translation_progress"
# Bump this when translation/review logic changes to avoid stale cached output.
PIPELINE_VERSION = "natural-ai-review-v3.9-meaning-dialogue"

os.makedirs(SAVE_FOLDER, exist_ok=True)


def get_job_id(file_content, style, pipeline_version=PIPELINE_VERSION):
    unique_data = (
        file_content + b"\x00" + style.encode("utf-8")
        + b"\x00" + pipeline_version.encode("utf-8")
    )
    user_id = current_user_sub()
    if user_id:
        unique_data += b'\x00' + user_id.encode('utf-8')
    return hashlib.sha256(unique_data).hexdigest()


def get_save_path(job_id):
    return os.path.join(
        SAVE_FOLDER,
        f"{job_id}.json"
    )


def save_progress(job_id, translations):
    path = get_save_path(job_id)
    temp_path = path + ".tmp"

    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(
            translations,
            f,
            ensure_ascii=False,
            indent=2
        )

    os.replace(temp_path, path)


def load_progress(job_id):
    path = get_save_path(job_id)

    if not os.path.exists(path):
        return {}

    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
