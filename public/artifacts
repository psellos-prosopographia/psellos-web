# dist output structure

Compiled artifacts in `dist/` are static JSON designed for downstream consumption.

```
dist/
  manifest.json           # spec version, counts, and person index
  persons.json            # person id -> person object (verbatim)
  assertions.json         # assertions array (verbatim)
  assertions_by_person.json  # person id -> assertion ids (subject + object)
  assertions_by_id.json   # assertion id -> assertion object (verbatim)
  assertions_by_layer.json  # layer id -> assertion ids
  assertions_by_person_by_layer.json  # person id -> layer id -> assertion ids
  layers.json             # layer ids (sorted)
```

Notes:

- File names are stable to keep consumer integration simple.
- `manifest.json` includes `spec_version`, `counts`, and `person_index` (person id → name).
- Manifest person index uses best-effort display name resolution (name/label/names/id).
- `persons.json` is an object keyed by person id containing the validated person objects
  from the input dataset (no enrichment).
- `assertions.json` is the validated assertions array from the input dataset (no enrichment).
- `assertions.json` uses flat endpoint IDs; person labels are resolved via persons.json.
- `assertions_by_person.json` is an adjacency index for O(1) lookup of assertions for a person,
  keyed by person id and populated from both subject and object endpoints.
- `assertions_by_id.json` is an adjacency index for O(1) lookup of assertions by id, reusing the
  same normalized assertion shape as `assertions.json`.
- `assertions_by_layer.json` indexes assertion IDs by narrative layer, defaulting to `canon` when
  the `extensions.psellos.layer` field is missing.
- `assertions_by_person_by_layer.json` indexes assertion IDs by person and layer, combining subject
  and object endpoints, and defaulting to `canon` when the `extensions.psellos.layer` field is missing.
- `layers.json` lists available narrative layers, derived from `assertions_by_layer.json` keys.
- Adjacency indices are rebuilt on every run and are authoritative for downstream consumers.
