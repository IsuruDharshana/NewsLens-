"""RSS feed source configuration for Sri Lankan news."""

# Priority 0 — Must have
# Priority 1 — Important
# Priority 2 — Nice to have

FEED_SOURCES = [
    {
        "name": "Ada Derana",
        "url": "https://www.adaderana.lk/rss/",
        "language": "en",
        "priority": 0,
    },
    {
        "name": "Daily Mirror",
        "url": "https://www.dailymirror.lk/rss",
        "language": "en",
        "priority": 0,
    },
    {
        "name": "NewsFirst",
        "url": "https://www.newsfirst.lk/feed/",
        "language": "en",
        "priority": 0,
    },
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
        "name": "Daily FT",
        "url": "https://www.ft.lk/feed",
        "language": "en",
        "priority": 1,
    },
    {
        "name": "Lanka Business Online",
        "url": "https://www.lankabusinessonline.com/feed/",
        "language": "en",
        "priority": 1,
    },
    {
        "name": "Daily News",
        "url": "https://www.dailynews.lk/feed",
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
