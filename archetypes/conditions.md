---
title: "{{ replace .File.ContentBaseName `-` ` ` | title }}"
date: {{ .Date }}
draft: true

# Patient-facing description of this condition
description: ""

# Optional plain-language note shown above the trial listing
# Use for context specific to this condition (e.g. link to a related project)
patient_note: ""

# Scientific curator for this condition (slug from content/curators/)
# Optional — leave empty if no named curator has been assigned
curator: ""

# GregoryAI API configuration
# The React component reads these as data attributes on the mount point div
# Endpoint base is controlled by params.apiBase in hugo.toml
# (override with HUGO_PARAMS_APIBASE=http://localhost:8000 for local dev)
api:
  endpoint: "https://api.gregory-ms.com/trials/"
  team_id: 1       # team_id is always 1 for this GregoryAI instance
  subject_id: 0    # TODO: replace with the subject_id for this condition

# Default filters applied when the React component first loads
# Visitors can override these via UI controls on the page
filters:
  default_status: "Recruiting"   # Recruiting | All
  default_phase: ""              # Phase I | Phase II | Phase III | Phase IV | (empty = all)
  default_study_type: ""         # Interventional | Observational | (empty = all)

# Display options
options:
  header: "small"
---
