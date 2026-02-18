---
title: "{{ replace .File.ContentBaseName `-` ` ` | title }}"
date: {{ .Date }}
draft: true

# Short description for cards and meta
description: ""

# Scientific curator(s) for this area (slugs from content/curators/)
curators: []

# Search queries used to populate this area
queries: []
# - string: "(term[Title/Abstract]) AND (term[Title/Abstract])"
#   source: "PubMed"
#   name: "Human-readable name"
#   status: "active" # active | zero_results | low_results

# Whether to display the search methodology to visitors
show_queries: false

# Keywords for internal tagging
keywords: []

# Clinical trial condition pages related to this area (slugs from content/clinical-trials/)
# Used to render disease tag links on the page
conditions: []

# Key concepts — 3-5 terms with plain-language definitions
# Provided by the scientific curator. Leave as placeholders until confirmed.
concepts: []
# - term: ""
#   definition: ""

# Display options
options:
  header: "small"
---
