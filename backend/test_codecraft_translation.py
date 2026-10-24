"""One short, optional CodeCraft inference test for EUMF SubNexa.

Run inside backend's activated virtual environment:
    python test_codecraft_translation.py

Uses existing backend/.env. Does not print the API key.
Warning: sends one real request and may consume CodeCraft credits.
"""

from dotenv import load_dotenv

load_dotenv()

from codecraft_fallback import enabled, generate_array, CodeCraftError


def main() -> None:
    if not enabled():
        print("CodeCraft fallback is disabled or its API key is not configured.")
        return

    print("Sending ONE short CodeCraft translation request (may use credits)...")
    prompt = (
        'Translate the following English movie subtitle dialogue into natural, '
        'conversational Sri Lankan Sinhala. Preserve the exact meaning. '
        'Return ONLY a valid JSON array with exactly one Sinhala string. '
        'English subtitle JSON: ["Hello, my friend!"]'
    )
    try:
        result = generate_array(prompt, expected=1)
    except CodeCraftError as exc:
        status = f" (HTTP {exc.status})" if exc.status is not None else ""
        print("CodeCraft inference failed" + status + ".")
        if exc.status == 402:
            print("Provider reports payment/credit access unavailable; do not add funds just for this test.")
        elif exc.status in (401, 403):
            print("Provider denied the inference request; model listing access alone is insufficient.")
        else:
            print("Check model access, service status, and the provider dashboard.")
    except (ValueError, RuntimeError) as exc:
        print("CodeCraft response was unusable: " + type(exc).__name__)
    else:
        print("CodeCraft inference: OK")
        print("Sinhala result:", result[0])


if __name__ == "__main__":
    main()
