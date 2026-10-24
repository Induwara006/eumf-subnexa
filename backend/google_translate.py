
import os
import asyncio
from dotenv import load_dotenv

load_dotenv()


async def google_translate_to_sinhala(text: str) -> str:
    """Translate English text to Sinhala using Google Cloud."""

    if not text.strip():
        return text

    def translate():
        from google.cloud import translate_v2 as translate

        client = translate.Client()

        result = client.translate(
            text,
            source_language="en",
            target_language="si",
            format_="text"
        )

        return result["translatedText"]

    return await asyncio.to_thread(translate)
