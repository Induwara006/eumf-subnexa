import asyncio
import json
from urllib import request

async def translate_to_sinhala(text: str, style: str = "natural"):
    styles = {
        "natural": "Natural Sinhala for movie subtitles.",
        "casual": "Casual spoken Sinhala.",
        "formal": "Formal Sinhala."
    }

    selected_style = styles.get(style, styles["natural"])

    def call_ollama():
        data = {
            "model": "qwen2.5:3b",
            "stream": False,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Translate English subtitles into Sinhala. "
                        "Preserve meaning and emotion. "
                        f"Style: {selected_style} "
                        "Reply only with the Sinhala translation."
                    )
                },
                {
                    "role": "user",
                    "content": text
                }
            ]
        }

        payload = json.dumps(data).encode("utf-8")

        req = request.Request(
            "http://127.0.0.1:11434/api/chat",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )

        with request.urlopen(req, timeout=120) as response:
            result = json.loads(response.read().decode("utf-8"))

        return result["message"]["content"]

    return await asyncio.to_thread(call_ollama)