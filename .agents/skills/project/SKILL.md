# Skills: TaxWise Clone Development

## Skill 1: Reactive Form Engine (Convex + Next.js)
- **Concept:** Create a `fields` table in Convex indexed by `returnId` and `fieldId` (e.g., "1040_L1").
- **Implementation:** Use `useQuery` in Next.js to make every input field "Live." When the user types, it triggers a Convex mutation that updates the field and immediately recalculates all dependent fields server-side.

## Skill 2: TaxWise UI Replication
- **Forms Tree:** Use a recursive sidebar component to navigate between the "Main Form," "Schedules," and "Worksheets."
- **Line Diagnostics:** Build a "Diagnostics" panel that scans the Convex store for missing required fields (e.g., missing SSN) and highlights the inputs in red.
- **Calculated Overrides:** Implement the ability to "Lock" a field (TaxWise's F5 key functionality) to prevent automatic calculations from overwriting manual entries.

## Skill 3: Tax Logic "Flow-Through"
- **Dependency Mapping:** Map how data moves between forms.
    - *Example:* `Schedule 1, Line 10` -> `Form 1040, Line 8`.
- **Convex Logic:** Write Convex internal functions that act as "Trigger Listeners." When Schedule 1 changes, the function automatically updates the 1040 entry in the same transaction.

## Skill 4: Document Handling
- **IRS Overlay:** Skill in using `pdf-lib` to take JSON data from Convex and flatten it onto an official IRS Form 1040 PDF for printing.
- **File Storage:** Using [Convex File Storage](https://docs.convex.dev) to manage client W-2 uploads and generated PDF archives.

## Skill 5: LLM Function Calling for Data Entry
- **Skill:** Integrating OpenAI/Anthropic function calling to parse "Natural Language" (e.g., "She earned 5k in tips") and mapping it to the correct Convex field ID (`f1040_tips`).