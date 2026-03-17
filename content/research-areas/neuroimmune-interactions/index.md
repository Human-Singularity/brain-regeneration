---
title: "Neuroimmune Interactions"
date: 2025-01-06
draft: false
subscribe: true

description: "How cell metabolism shapes brain-immune interactions, with a focus on new therapeutic approaches for MS and other CNS disorders."

curators:
  - "lpj-lab"

api:
  endpoint: "https://api.gregory-ms.com/articles/"
  team_id: 5
  subject_id: 11

queries:
  - string: "(neuroimmune interaction[Title/Abstract]) AND (multiple sclerosis[Title/Abstract] OR CNS[Title/Abstract])"
    source: "PubMed"
    name: "Neuroimmune Interaction - MS/CNS"
    status: "active"
  - string: "(neuroimmune regulation[Title/Abstract]) AND (metabolism[Title/Abstract] OR metabolic[Title/Abstract])"
    source: "PubMed"
    name: "Neuroimmune Regulation - Metabolism"
    status: "active"
  - string: "(brain immune interaction[Title/Abstract]) AND (cell metabolism[Title/Abstract])"
    source: "PubMed"
    name: "Brain Immune Interaction - Cell Metabolism"
    status: "zero_results"
  - string: "(microglia[Title/Abstract]) AND (metabolism[Title/Abstract]) AND (neurodegeneration[Title/Abstract] OR demyelination[Title/Abstract])"
    source: "PubMed"
    name: "Microglia Metabolism - Neurodegeneration"
    status: "active"

show_queries: false

keywords:
  - "neuroimmune regulation"
  - "neuroimmune interaction"
  - "cell metabolism"
  - "microglia"
  - "demyelination"

conditions:
  - "multiple-sclerosis"

# Key concepts — to be provided by LPJ Lab
concepts:
  - term: "Neuroimmune interaction"
    definition: ""
  - term: "Microglia"
    definition: ""
  - term: "Cell metabolism"
    definition: ""
  - term: "Demyelination"
    definition: ""
  - term: "Neuroimmune regulation"
    definition: ""
---

The immune system and the nervous system were once studied as largely separate domains. Research over the past two decades has established that they are deeply interconnected — and that the nature of that connection shapes whether the brain recovers from damage or continues to deteriorate.

In conditions like Multiple Sclerosis, the immune system turns against the nervous system, attacking the myelin sheath that insulates nerve fibres. But the relationship is not simply one of attack and defence. Immune cells resident in the brain — particularly microglia — are continuously monitoring neural tissue, responding to injury and infection, and influencing the local environment in ways that can be either protective or harmful.

A key insight emerging from this field is that cell metabolism mediates many of these interactions. How immune cells produce and consume energy shapes their behaviour: whether microglia drive inflammation or support repair, whether peripheral immune cells breach the blood-brain barrier, whether the conditions in neural tissue favour recovery. This metabolic dimension opens a new category of therapeutic targets — intervening not in the immune response itself, but in the energetic processes that drive it.

For brain regeneration, this matters because any strategy that aims to repair damaged neural tissue must operate in a neuroinflammatory environment. Understanding and modulating the immune context is not a secondary consideration — it is a prerequisite for regeneration to succeed.
