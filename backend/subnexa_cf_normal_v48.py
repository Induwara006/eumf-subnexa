"""SubNexa 0.2: plan batches of up to 15 subtitle entries."""


def select_cloudflare_batch(remaining, originals):
    return remaining[:15]