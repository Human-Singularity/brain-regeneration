---
title: "{{ replace .File.ContentBaseName `-` ` ` | title }}"
date: {{ .Date }}
draft: true

# Short summary for cards and meta
description: ""

# Author (slug from content/curators/ or free text)
author: ""

# Optional image for the news card (relative path in page bundle)
image: ""
# Optional caption for the header image. Set to false to hide the caption entirely.
# If omitted, falls back to the page description.
image_caption: ""
# Optional: where to crop the header image. Defaults to "Smart" (Hugo picks the
# most interesting region). Or one of Center, Top, Bottom, Left, Right, TopLeft,
# TopRight, BottomLeft, BottomRight.
image_anchor: ""

# Tags for categorisation
tags: []

# Display options
options:
  header: "small"
---
