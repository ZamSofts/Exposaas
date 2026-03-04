import { prisma, getSession } from "@/lib/useful";

export default async function handler(req, res) {
  const session = await getSession(req, res);
  try {
    // GET: list prompt versions for company
    if (req.method === "GET") {
      const versions = await prisma.promptVersion.findMany({
        where: { companyId: session.companyId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          version: true,
          strategy: true,
          status: true,
          score: true,
          scoreDetails: true,
          parentId: true,
          createdAt: true,
          evaluatedAt: true,
        },
      });

      // Find active version
      const active = versions.find(v => v.status === "active");

      return res.status(200).json({ versions, activeId: active?.id || null });
    }

    // POST: create new version, generate variations, or trigger evaluation
    if (req.method === "POST") {
      const { action, content, version, strategy, parentId, promptVersionId } = req.body;

      // Action: generate prompt variations
      if (action === "generate") {
        const { generatePromptVariations } = await import("../../../extra/utils/promptGenerator.mjs");

        // Get current active prompt or use hardcoded base
        const activePrompt = await prisma.promptVersion.findFirst({
          where: { companyId: session.companyId, status: "active" },
          select: { id: true, content: true },
        });

        // Get accuracy data
        // Compute accuracy inline (no need to import handler)
        const allRecords = await prisma.paymentConfirmation.findMany({
          where: { companyId: session.companyId, diffSummary: { not: null } },
          select: { diffSummary: true, auctionHouse: true, isCorrect: true },
        });

        // Build accuracy data
        const fieldErrors = {};
        const auctionStats = {};

        for (const r of allRecords) {
          // Auction stats
          const auction = r.auctionHouse || "Unknown";
          if (!auctionStats[auction]) auctionStats[auction] = { total: 0, exact: 0 };
          auctionStats[auction].total++;
          if (r.isCorrect === "exact_match") auctionStats[auction].exact++;

          // Field stats
          const diff = r.diffSummary;
          if (!diff?.vehicles) continue;
          for (const v of diff.vehicles) {
            for (const field of Object.keys(v.fields || {})) {
              if (!fieldErrors[field]) fieldErrors[field] = { total: 0, errors: 0 };
              fieldErrors[field].errors++;
            }
            const chargeChanges = (v.charges?.added?.length || 0) + (v.charges?.removed?.length || 0) + (v.charges?.changed?.length || 0);
            if (chargeChanges > 0) {
              if (!fieldErrors.charges) fieldErrors.charges = { total: 0, errors: 0 };
              fieldErrors.charges.errors += chargeChanges;
            }
          }
        }

        // Total records per field
        const totalReviewed = allRecords.length;
        const byField = Object.entries(fieldErrors).map(([field, data]) => ({
          field,
          accuracy: totalReviewed > 0 ? 1 - (data.errors / totalReviewed) : 1,
          errors: data.errors,
          total: totalReviewed,
        }));

        const byAuction = Object.entries(auctionStats).map(([auction, data]) => ({
          auction,
          accuracy: data.total > 0 ? data.exact / data.total : 0,
          count: data.total,
        }));

        const basePrompt = activePrompt?.content || "";
        if (!basePrompt) {
          return res.status(400).json({ error: "No active prompt version found. Create one first." });
        }

        const variations = await generatePromptVariations(basePrompt, { byField, byAuction }, session.companyId);

        // Save each variation as a draft PromptVersion
        const existingCount = await prisma.promptVersion.count({
          where: { companyId: session.companyId },
        });

        const created = [];
        for (let i = 0; i < variations.length; i++) {
          const v = variations[i];
          const pv = await prisma.promptVersion.create({
            data: {
              version: `v${existingCount + i + 1}.0`,
              content: v.content,
              strategy: v.strategy,
              status: "draft",
              parentId: activePrompt?.id || null,
              companyId: session.companyId,
            },
          });
          created.push({ id: pv.id, version: pv.version, strategy: v.strategy, description: v.description });
        }

        return res.status(201).json({ generated: created });
      }

      // Action: initialize first prompt version from schema-aware defaults
      if (action === "init") {
        // Check if any version already exists
        const existing = await prisma.promptVersion.findFirst({
          where: { companyId: session.companyId },
          select: { id: true },
        });
        if (existing) {
          return res.status(400).json({ error: "Prompt versions already exist. Use 'optimize' instead." });
        }

        const { buildDefaultInstructions } = await import("../../../extra/ai/promptBuilder.mjs");
        const { EXTRACTION_SCHEMA } = await import("../../../extra/ai/schema.mjs");

        const defaultContent = buildDefaultInstructions(EXTRACTION_SCHEMA);

        const created = await prisma.promptVersion.create({
          data: {
            version: "v1.0",
            content: defaultContent,
            strategy: "schema_default",
            status: "active",
            companyId: session.companyId,
          },
        });

        return res.status(201).json(created);
      }

      // Action: AI-powered optimization (meta-prompting)
      if (action === "optimize") {
        const { runOptimization } = await import("../../../extra/ai/optimizer.mjs");

        const results = await runOptimization(session.companyId);

        if (results.error) {
          return res.status(400).json({ error: results.error, step: results.step });
        }

        return res.status(200).json(results);
      }

      // Action: evaluate a prompt version
      if (action === "evaluate") {
        if (!promptVersionId) return res.status(400).json({ error: "Missing promptVersionId" });

        const { evaluatePromptVersion } = await import("../../../extra/utils/promptEvaluator.mjs");

        // Run evaluation (this may take a while)
        const results = await evaluatePromptVersion(Number(promptVersionId), session.companyId);

        return res.status(200).json(results);
      }

      // Default: create new version manually
      if (!content) return res.status(400).json({ error: "Missing prompt content" });

      const existingCount = await prisma.promptVersion.count({
        where: { companyId: session.companyId },
      });

      const created = await prisma.promptVersion.create({
        data: {
          version: version || `v${existingCount + 1}.0`,
          content,
          strategy: strategy || "manual",
          status: "draft",
          parentId: parentId ? Number(parentId) : null,
          companyId: session.companyId,
        },
      });

      return res.status(201).json(created);
    }

    // PUT: update status (activate, archive, etc.)
    if (req.method === "PUT") {
      const { id, action } = req.body;
      if (!id) return res.status(400).json({ error: "Missing version id" });

      const record = await prisma.promptVersion.findFirst({
        where: { id: Number(id), companyId: session.companyId },
      });
      if (!record) return res.status(404).json({ error: "Prompt version not found" });

      if (action === "activate") {
        // Deactivate all others, activate this one
        await prisma.promptVersion.updateMany({
          where: { companyId: session.companyId, status: "active" },
          data: { status: "archived" },
        });
        const updated = await prisma.promptVersion.update({
          where: { id: record.id },
          data: { status: "active" },
        });
        return res.status(200).json(updated);
      }

      if (action === "archive") {
        const updated = await prisma.promptVersion.update({
          where: { id: record.id },
          data: { status: "archived" },
        });
        return res.status(200).json(updated);
      }

      return res.status(400).json({ error: "Invalid action. Use 'activate' or 'archive'" });
    }

    // DELETE: remove a draft prompt version
    if (req.method === "DELETE") {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: "Missing version id" });

      const record = await prisma.promptVersion.findFirst({
        where: { id: Number(id), companyId: session.companyId },
      });
      if (!record) return res.status(404).json({ error: "Prompt version not found" });
      if (record.status === "active") return res.status(400).json({ error: "Cannot delete active prompt version" });

      await prisma.promptVersion.delete({ where: { id: record.id } });
      return res.status(200).json({ deleted: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("promptVersion error:", err?.message || err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
