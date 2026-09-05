"""Text sanitisation helpers."""

import re

# Match any HTML tag, including attributes and closing tags.
_HTML_TAG_RE = re.compile(r"<[^>]+>", re.DOTALL)

# Collapse multiple whitespace characters into a single space.
_MULTISPACE_RE = re.compile(r"\s+")


def strip_html_tags(html: str | None) -> str:
    """Remove HTML tags and normalise whitespace.

    Returns an empty string for None input so callers can chain `.strip()`
    safely.
    """
    if not html:
        return ""
    text = _HTML_TAG_RE.sub(" ", html)
    text = _MULTISPACE_RE.sub(" ", text)
    return text.strip()
