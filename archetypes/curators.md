---
title: "{{ replace .File.ContentBaseName `-` ` ` | title }}"
date: {{ .Date }}
draft: true

# Curator identity
name: ""
type_of: "organisation" # organisation | individual
lead_researcher: ""
institution: ""
website: ""
logo: "" # relative path to logo image in page bundle
bio: ""

# Research areas this curator curates (slugs from content/research-areas/)
research_areas: []

# Commitment level (from the project brief)
# - searches: provides search queries
# - categories: provides category structure
# - legitimacy: public endorsement
# - dissemination: shares with their network
# - ml_training: assists in training ML models
commitment: []

# Display options
options:
  header: "small"
---
