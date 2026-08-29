"""RSS feed source configuration for Sri Lankan news."""

# Priority 0 — Must have
# Priority 1 — Important
# Priority 2 — Nice to have

FEED_SOURCES = [
    {
        "name": "The Island",
        "url": "https://island.lk/feed/",
        "language": "en",
        "priority": 0,
    },
    {
        "name": "EconomyNext",
        "url": "https://economynext.com/feed/",
        "language": "en",
        "priority": 0,
    },
    {
        "name": "Daily News",
        "url": "https://www.dailynews.lk/feed",
        "language": "en",
        "priority": 0,
    },
    {
        "name": "Lanka Business Online",
        "url": "https://www.lankabusinessonline.com/feed/",
        "language": "en",
        "priority": 0,
    },
    {
        "name": "NewsWire",
        "url": "https://newswire.lk/feed/",
        "language": "en",
        "priority": 0,
    },
    {
        "name": "Sri Lanka Mirror",
        "url": "https://srilankamirror.com/feed/",
        "language": "en",
        "priority": 1,
    },
]

# Categories for article classification
CATEGORIES = [
    "Politics",
    "Economy",
    "Sports",
    "Technology",
    "Health",
    "Education",
    "Environment",
    "Entertainment",
]
