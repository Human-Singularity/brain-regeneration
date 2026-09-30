---
title: ""
outlet: ""
date: {{ now.Format "2006-01-02" }}
# date_precision: year   # set when only the year is known (hides the day in the timeline, RSS and JSON-LD)
media_type: article            # article | tv | radio | podcast | paper
language: en             # BCP 47 code of the original piece
external_url: ""
links: []                # optional extra links: - label: "Part 2"  url: "https://..."
summary: ""              # English summary
thumbnail: thumbnail.jpg # bundle resource name (~1200px wide)
thumbnail_style: ""      # "logo" = contain on white
build:
  render: never
  list: always
---
