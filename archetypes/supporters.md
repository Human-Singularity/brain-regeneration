---
title: "{{ replace .File.ContentBaseName `-` ` ` | title }}"
date: {{ .Date }}
draft: true

# Supporter identity
name: ""
type_of: "organisation" # organisation | individual
representative: ""
institution: ""
website: ""
logo: "" # relative path to logo image in page bundle
bio: ""

# Research areas this supporter is associated with (slugs from content/research-areas/)
research_areas: []

# Display options
options:
  header: "small"
---
