"""Split SubNexa 0.2 subtitles into two planned batches."""


def select_cloudflare_batch(remaining, originals):
    if not remaining:
        return []

    batch_size = max(1, (len(originals) + 1) // 2)
    return remaining[:batch_size]