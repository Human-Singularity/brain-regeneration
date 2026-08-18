---
title: "Time is brain, and your research shouldn't pay the price"
date: 2026-05-23T10:00:00+01:00
draft: false

description: "A short tour of the features we built to save researchers time. A unified PubMed/bioRxiv/MedRxiv feed and AI relevance ranking, and weekly digests."

author: ""
kicker: "Editorial · Methodology"
resources:
image: yen-vu-TdgfSyDoWBE-unsplash.jpg
image_caption: false
tags:
  - brain-regeneration
  - gregory-ai
  - research
  - open-science
  - workflow
  - clinical-trials

options:
  header: "small"
---

Keeping up with the current research can become a full-time job with less pay and glory. And most tasks that it involves take precious time: Running searches, scanning trial registries, organising what's relevant and what's not.

And after all this time, it may amount to nothing. No insights, no improvements to current practice, and no new hope for patients.

## Why this saves time differently from a generic AI tool

Our goal is quality. Generative AI is only as good as the input it receives, otherwise it hallucinates and misses important information. 

That's why we scan only the most reputable sources. Also, our system is self-contained (we don't depend on Anthropic or OpenAI) and is under constant human review. The MS research page is curated manually to make sure we do not miss papers with mentions of myelin repair or brain-penetrant anti-inflammatories.

We are working towards expanding this human review to other research areas and conditions.

The search queries are validated by the scientists doing the work — [REGENERAR](/curators/regenerar/) at Coimbra for cell reprogramming, [LPJ Lab](/curators/lpj-lab/) at Cambridge for neuroimmunometabolism, [iMed.ULisboa](/curators/institute-cns-inflammation/) for neuroinflammation.

Our methodology, the data, and [the code](https://github.com/Human-Singularity/brain-regeneration) are open — you can audit anything, including how we tag categories. Third, the engine is the same [GregoryAi](https://gregory-ai.com) that has been running [Gregory-MS](https://gregory-ms.com) since 2021, with 42,000+ articles indexed and 4,400+ flagged as relevant for MS alone.

## One feed, all the registries

From [PubMed](https://pubmed.ncbi.nlm.nih.gov/) to [bioRxiv](https://www.biorxiv.org/), we harvest several different sources to stay up to date with research. Clinical Trials are also tracked from the [International Clinical Trial Registry Platform (ICTRP)](https://www.who.int/tools/clinical-trials-registry-platform), [European Clinical Trial Registry](https://www.clinicaltrialsregister.eu/), and [ClinicalTrialsGov](https://clinicaltrials.gov).

Our system removes duplicates, fills in missing data from [CrossRef](https://www.crossref.org/), and runs Machine Learning (ML) algorithms to surface research with positive patient outcomes. This happens daily.

We then present them as a single feed per [research area](/research-areas/) and [condition](/conditions/).

{{< figure src="brain-regeneration-research-area-feed.png" treatment="screenshot" alt="Brain Regeneration Observatory research papers feed filtered by research area" fig="02" caption="A single feed pulling from PubMed, bioRxiv, medRxiv, ICTRP and CrossRef. The relevance score is the GregoryAi score; the toggle switches between Relevant and Full feed." credit="Screenshot: brain-regeneration.com" ui_url="brain-regeneration.com/research-areas/cell-reprogramming" >}}

## Search queries you can read
Each research area page lists the exact PubMed-style queries our scientific curators use to populate the feed — under "Search methodology". You can see why a paper showed up, copy a query into your own workflow, or flag one that needs widening.

{{< figure src="brain-regeneration-research-queries-pubmed.png" treatment="screenshot" alt="PubMed-style search queries listed on the Brain Regeneration Observatory research area page" fig="03" caption="Each research area page lists the exact PubMed-style queries curators use to populate the feed, under Search methodology." credit="Screenshot: brain-regeneration.com" ui_url="brain-regeneration.com/research-areas/neuroinflammation" >}}

## AI relevance to surface promising research



We use [GregoryAi](https://gregory-ai.com/) to score every paper for relevance using independent machine-learning models, displayed on each article (we show the algorithm, the percentage, and the threshold). On any feed you can switch between "Relevant papers" and "Full feed", or sort by AI relevance instead of date. The triage your eyes used to do — done before you arrive.

{{< figure src="ml-relevance-scores-pubmed-bert-lgbm-tfidf-lstm-gregory-ms.png" treatment="screenshot" alt="ML Relevance scores panel showing three algorithm results for a General category article marked as Relevant: pubmed_bert at 100%, lgbm_tfidf at 78%, and lstm at 90%. Threshold is 0.8." fig="04" caption="Three independent models score each paper; we surface anything two of three agree on" credit="Screenshot: brain-regeneration.com" ui_url="/brain-regeneration.com/articles/299728/" >}}

There is also an option to download the listing to a CSV[^1] file.
[^1]: CSV (Comma-Separated Values) is a plain-text format where each row is a line and columns are separated by commas. CSV files can be opened in spreadsheet apps like Excel or Google Sheets, or processed programmatically.

{{< figure src="brain-regeneration-dihydroartemisinin-research-search-results-ml-relevance-scores.png" treatment="screenshot" alt="Search interface showing relevant papers on dihydroartemisinin, with ML relevance scores from pubmed_bert, lgbm_tfidf, and lstm algorithms, and a download dropdown offering 'Current page' or 'All matching results' options." fig="05" caption="Keyword search with ML relevance scores and a one-click CSV export of the current page or all matching results." credit="brain-regeneration.com" ui_url="brain-regeneration.com/conditions/multiple-sclerosis/research-papers/" >}}

## Linked clinical trials

When an article mentions an NCT number or equivalent identifier, we extract it and link the trial directly from the article page. If you are mapping a therapeutic area, the citation-to-trial step is done.

## Filter, search, and export

The research feed has a filter bar with keyword search, category filters (for example, by drug or treatment type — Ocrelizumab, Cladribine, Stem Cells, CAR-T — on the [MS papers page](/conditions/multiple-sclerosis/research-papers/)), and date or relevance sorting. When you find a slice you want to keep, the Download button exports either the current page or every matching result as CSV. Drop it into Zotero, EndNote, or a spreadsheet.

{{< figure src="brain-regeneration-category-filter-ms-treatments-monoclonal-antibodies-s1p-modulators-dropdown.png" treatment="screenshot" alt="category filter dropdown expanded during a dihydroartemisinin search, showing MS treatment categories including Monoclonal Antibodies (Ocrelizumab, Rituximab, Natalizumab and others), S1P Receptor Modulators (Fingolimod highlighted, Siponimod, Ponesimod), Oral Small Molecules (Dimethyl Fumarate, Teriflunomide, Cladribine), Cytotoxic Immunosuppressant (Mitoxantrone), and Cell-Based Therapies (CAR-T Cell Therapy, Stem Cells)" fig="06" caption="Category filters on the MS research papers feed, grouped by drug class." credit="Screenshot: brain-regeneration.com" ui_url="brain-regeneration.com/conditions/multiple-sclerosis/research-papers/" >}}

## A weekly digest you can trust

Every research area and condition page has a one-click subscription to a weekly digest. These emails include the most relevant papers discovered, and the recent clinical trials registered.

## Save time finding clinical trials

Our clinical trial alerts fire every six hours to make sure you, and your patients, don't miss the chance to participate.

## Try it on your own area

Pick one — [cell reprogramming](/research-areas/cell-reprogramming/), [neuroinflammation](/research-areas/neuroinflammation/), or [neuroimmunometabolism](/research-areas/neuroimmunometabolism/) — and run a search you would normally run in PubMed. If the curated query is too narrow or too broad for what you do, [tell us](/contact/). The point of building in the open is that the observatory gets sharper when researchers push back.

And if you lead a group working on a brain regeneration topic we do not yet cover, we are looking for [scientific curators](/contact/) to expand the observatory. Your queries, our infrastructure, your community's time saved.
