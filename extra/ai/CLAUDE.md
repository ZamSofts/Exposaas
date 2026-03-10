# AI Pipeline Context

## Files

| File | Purpose |
|------|---------|
| `schema.mjs` | Field extraction rules & constraints (what Gemini extracts) |
| `promptBuilder.mjs` | Assembles prompt: instructions + schema + few-shot + output format. NOT an LLM -- just string concatenation |
| `classificationSchema.mjs` | Document type classification (invoice, export_cert, inspection_cert, temp_cancel, unknown) |
| `documentSchemas.mjs` | Type-specific extraction schemas for certs |
| `optimizer.mjs` | OPRO-style meta-prompting (available but expensive -- 99+ Gemini calls per run) |
| `zodSchemas.mjs` | Zod validation schemas for AI outputs |

## Gotchas

- **promptBuilder is NOT an LLM** -- it's string concatenation of 4 sections. Don't try to "call" it like an AI model.
- **Two-stage pipeline for documents:** Classification (page 1 only, cheap) → type-specific extraction. Don't skip classification.
- **Confidence thresholds** are in `src/config/aiConstants.js` (HIGH=0.85, MID=0.60). Never hardcode these values.
- **Few-shot selection** uses embedding similarity first, then falls back to tier-based matching. See `extra/utils/fewShotExamples.mjs`.
- **Rate limiting:** Gemini API has rate limits. Workers use exponential backoff retry. Don't bypass this.
- **Certs don't need HITL:** Government-standard format, accuracy is already good. Only invoices need human review.

## Extraction Flow

```
PDF Upload
  → addDocument.js API
  → classify-document queue (page 1 only)
  → classifyDocument worker → determines type
  → If invoice: gemini-extract queue → invoice worker → page split → gemini-extract-page queue
  → If cert: extract-document queue → documentExtract worker
```

## AI Learning Loop

Golden records improve accuracy automatically:
1. User reviews extraction → corrections saved as diff
2. Corrected records marked as golden → auto-embedded via Gemini Embedding API
3. Next extraction picks semantically similar golden records as few-shot examples
4. More golden data = better few-shot = better accuracy
