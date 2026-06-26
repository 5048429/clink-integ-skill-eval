import fs from "fs";
import path from "path";
import process from "process";
import { fileURLToPath, pathToFileURL } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultSkillRoot = path.resolve(repoRoot, "..", "agent-prompts", "skills", "clink-integ-skills");
const defaultCasesPath = path.join(repoRoot, "cases", "clink-integ-capability-matrix.json");
const defaultReportPath = path.join(repoRoot, "reports", "latest-report.json");

function parseArgs(argv) {
  const args = argv.slice(2);
  const reportPath = valueAfter(args, "--report") || defaultReportPath;
  return {
    json: args.includes("--json"),
    noFail: args.includes("--no-fail"),
    skillRoot: valueAfter(args, "--skill-root") || process.env.CLINK_SKILL_ROOT || defaultSkillRoot,
    casesPath: valueAfter(args, "--cases") || defaultCasesPath,
    reportPath,
    markdownReportPath:
      valueAfter(args, "--report-md") ||
      valueAfter(args, "--markdown-report") ||
      replaceReportExtension(reportPath, ".md"),
  };
}

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
}

function ensureFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

function replaceReportExtension(filePath, extension) {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}${extension}`);
}

async function loadSkillRuntime(skillRoot) {
  const runtimePath = path.join(skillRoot, "lib", "skill-runtime.mjs");
  ensureFile(runtimePath, "skill runtime");
  return import(pathToFileURL(runtimePath).href);
}

function defaultDocsFallback(skillRoot) {
  const candidate = path.join(skillRoot, "tests", "fixtures", "public-docs", "llms-full.txt");
  return fs.existsSync(candidate) ? candidate : null;
}

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function includesText(items, needle) {
  const haystack = asArray(items).join("\n").toLowerCase();
  return haystack.includes(String(needle).toLowerCase());
}

function containsAny(items, needles) {
  return asArray(needles).some((needle) => includesText(items, needle));
}

function artifactSet(payload) {
  return new Set((payload.artifacts || []).map((item) => item.name));
}

function check(condition, message, failures) {
  if (!condition) failures.push(message);
}

function checkAllPresent(actual, expected, label, failures) {
  for (const item of asArray(expected)) {
    check(actual.has(item), `missing ${label}: ${item}`, failures);
  }
}

function checkNonePresent(actual, expected, label, failures) {
  for (const item of asArray(expected)) {
    check(!actual.has(item), `unexpected ${label}: ${item}`, failures);
  }
}

function checkTextIncludes(actual, expected, label, failures) {
  for (const item of asArray(expected)) {
    check(includesText(actual, item), `${label} missing text: ${item}`, failures);
  }
}

function checkTextExcludes(actual, expected, label, failures) {
  for (const item of asArray(expected)) {
    check(!includesText(actual, item), `${label} unexpectedly includes text: ${item}`, failures);
  }
}

function evaluateCase(testCase, payload) {
  const failures = [];
  const expect = testCase.expect || {};
  const artifacts = artifactSet(payload);
  const triggered = payload.route !== "none" && payload.route !== null && payload.route !== undefined;

  if (expect.expectedTrigger === false) {
    check(!triggered, `expected no Clink trigger, got route ${payload.route}`, failures);
    return failures;
  }

  check(triggered, "expected Clink trigger, got no route", failures);

  if (expect.route) {
    check(payload.route === expect.route, `expected route ${expect.route}, got ${payload.route}`, failures);
  }
  if (expect.routeIn) {
    check(expect.routeIn.includes(payload.route), `expected route in ${expect.routeIn.join(", ")}, got ${payload.route}`, failures);
  }
  if (expect.routeConfidence) {
    check(payload.routeConfidence === expect.routeConfidence, `expected routeConfidence ${expect.routeConfidence}, got ${payload.routeConfidence}`, failures);
  }
  if (expect.routeConfidenceIn) {
    check(expect.routeConfidenceIn.includes(payload.routeConfidence), `expected routeConfidence in ${expect.routeConfidenceIn.join(", ")}, got ${payload.routeConfidence}`, failures);
  }
  if (expect.environment) {
    check(payload.environment?.targetEnvironment === expect.environment, `expected environment ${expect.environment}, got ${payload.environment?.targetEnvironment}`, failures);
  }
  if (expect.docsGateInvoked !== undefined) {
    check(payload.docsGateInvoked === expect.docsGateInvoked, `expected docsGateInvoked ${expect.docsGateInvoked}, got ${payload.docsGateInvoked}`, failures);
  }
  if (expect.stack) {
    for (const [key, value] of Object.entries(expect.stack)) {
      check(payload.stack?.[key] === value, `expected stack.${key} ${value}, got ${payload.stack?.[key]}`, failures);
    }
  }
  if (expect.productionValidation) {
    const exists = payload.productionValidation !== null && payload.productionValidation !== undefined;
    if (expect.productionValidation.exists !== undefined) {
      check(exists === expect.productionValidation.exists, `expected productionValidation exists=${expect.productionValidation.exists}, got ${exists}`, failures);
    }
    if (exists && expect.productionValidation.passed !== undefined) {
      check(payload.productionValidation.passed === expect.productionValidation.passed, `expected productionValidation.passed ${expect.productionValidation.passed}, got ${payload.productionValidation.passed}`, failures);
    }
    if (exists && expect.productionValidation.skipped !== undefined) {
      check(payload.productionValidation.skipped === expect.productionValidation.skipped, `expected productionValidation.skipped ${expect.productionValidation.skipped}, got ${payload.productionValidation.skipped}`, failures);
    }
  }
  if (expect.runtimeState) {
    for (const [key, value] of Object.entries(expect.runtimeState)) {
      check(payload.runtimeState?.[key] === value, `expected runtimeState.${key} ${value}, got ${payload.runtimeState?.[key]}`, failures);
    }
  }
  if (expect.validation) {
    if (expect.validation.valid !== undefined) {
      check(payload.validation?.valid === expect.validation.valid, `expected validation.valid ${expect.validation.valid}, got ${payload.validation?.valid}`, failures);
    }
    checkTextIncludes(payload.validation?.errors || [], expect.validation.errorsInclude, "validation.errors", failures);
  }

  checkAllPresent(artifacts, expect.artifactsAll, "artifact", failures);
  checkNonePresent(artifacts, expect.artifactsNone, "artifact", failures);
  if (expect.artifactsAny) {
    check(asArray(expect.artifactsAny).some((item) => artifacts.has(item)), `missing any artifact from: ${asArray(expect.artifactsAny).join(", ")}`, failures);
  }

  checkTextIncludes(payload.notes || [], expect.notesInclude, "notes", failures);
  checkTextExcludes(payload.notes || [], expect.notesNotInclude, "notes", failures);
  if (expect.notesIncludeAny) {
    check(containsAny(payload.notes || [], expect.notesIncludeAny), `notes missing any text from: ${asArray(expect.notesIncludeAny).join(", ")}`, failures);
  }

  checkTextIncludes(payload.questions || [], expect.questionsInclude, "questions", failures);
  checkTextExcludes(payload.questions || [], expect.questionsNotInclude, "questions", failures);

  if (expect.ambiguousBetweenAll) {
    const actual = new Set(payload.ambiguousBetween || []);
    checkAllPresent(actual, expect.ambiguousBetweenAll, "ambiguous route", failures);
  }

  return failures;
}

function summarize(results, metadata, skillRoot) {
  const categoryStats = new Map();
  const routeStats = new Map();

  for (const result of results) {
    const category = result.category || "uncategorized";
    const route = result.route || "none";
    const cat = categoryStats.get(category) || { total: 0, passed: 0, failed: 0 };
    cat.total += 1;
    cat[result.passed ? "passed" : "failed"] += 1;
    categoryStats.set(category, cat);

    const routeEntry = routeStats.get(route) || { total: 0, passed: 0, failed: 0 };
    routeEntry.total += 1;
    routeEntry[result.passed ? "passed" : "failed"] += 1;
    routeStats.set(route, routeEntry);
  }

  const passed = results.filter((item) => item.passed).length;
  const total = results.length;
  return {
    name: metadata.name,
    version: metadata.version,
    skillRoot,
    total,
    passed,
    failed: total - passed,
    passRate: total === 0 ? 0 : Math.round((passed / total) * 1000) / 10,
    categoryStats: Object.fromEntries(categoryStats),
    routeStats: Object.fromEntries(routeStats),
  };
}

function buildConclusion(summary, results) {
  const failed = results.filter((item) => !item.passed);
  const passingCategories = Object.entries(summary.categoryStats)
    .filter(([, stats]) => stats.failed === 0)
    .map(([category]) => category);
  const failedCategories = Object.entries(summary.categoryStats)
    .filter(([, stats]) => stats.failed > 0)
    .sort((a, b) => b[1].failed - a[1].failed)
    .map(([category, stats]) => `${category} (${stats.failed} failed)`);

  let status = "PASS";
  let headline = "The skill passes the full capability matrix.";
  if (summary.failed > 0 && summary.passRate >= 85) {
    status = "STRONG_WITH_GAPS";
    headline = "The skill is strong overall, with a small number of capability gaps.";
  } else if (summary.failed > 0 && summary.passRate >= 70) {
    status = "USABLE_WITH_GAPS";
    headline = "The skill is usable for core integration work, but several capability gaps should be fixed before treating it as comprehensive.";
  } else if (summary.failed > 0) {
    status = "NEEDS_WORK";
    headline = "The skill needs substantial improvement before it should be used as a broad Clink integration assistant.";
  }

  return {
    status,
    headline,
    score: `${summary.passed}/${summary.total} (${summary.passRate}%)`,
    strengths: passingCategories,
    priorityAreas: failedCategories,
    recommendedFixes: dedupe(failed.map(recommendCaseFix)).slice(0, 8),
  };
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

function recommendCaseFix(result) {
  switch (result.id) {
    case "std-dashboard-fallback-not-primary":
      return "Add explicit runtime wording that Dashboard Webhooks is only fallback/manual/visibility while CLI endpoint ensure remains primary.";
    case "std-catalog-import":
      return "Route pricing-page/catalog-import prompts to standard integration and emit catalog import plus product/price sourcing artifacts.";
    case "std-external-psp-link":
      return "Add docs-gated handling for external PSP orchestration link_psp prompts, including checkout routing and settlement facts without unsupported behavior.";
    case "resource-order-sync":
      return "Treat order sync with webhook reconciliation as a standard integration task when implementation and merchant order mapping are requested.";
    case "resource-refund-lifecycle":
      return "Invoke the docs gate for refund lifecycle prompts and preserve the warning when public refund-create API is not confirmed.";
    case "usage-subscription-billing":
      return "Route subscription billing prompts to standard integration when product/price setup plus webhook handling is requested.";
    case "agent-generic-agentic-payment":
      return "Recognize agentic-payment-skills and clink-payment-skill as generic agent integration signals, not standard checkout.";
    case "precision-doc-qa":
      return "Honor docs-only/no-code prompts by routing to documentation dialogue and emitting a docs fact table.";
    case "precision-negative-stripe":
      return "Add negative-trigger detection for non-Clink PSP prompts such as Stripe-only checkout and webhook requests.";
    default: {
      const text = result.failures.join(" ");
      if (/expected route/.test(text)) return "Adjust route detection for this prompt shape.";
      if (/docsGateInvoked/.test(text)) return "Add docs-gate triggering for this exact API/resource claim.";
      if (/missing artifact/.test(text)) return "Emit the missing runtime artifact for this scenario.";
      if (/notes missing/.test(text)) return "Add an explicit runtime note for the required guidance.";
      if (/validation/.test(text)) return "Update validation logic or expected validation output.";
      return "Inspect the case assertions and align runtime routing, notes, questions, or artifacts.";
    }
  }
}

function compactPayload(payload) {
  return {
    route: payload.route,
    routeConfidence: payload.routeConfidence,
    environment: payload.environment?.targetEnvironment,
    docsGateInvoked: payload.docsGateInvoked,
    docsTraceAction: payload.docsTrace?.action,
    artifacts: (payload.artifacts || []).map((item) => item.name),
    questions: payload.questions || [],
    notes: payload.notes || [],
    validation: payload.validation || null,
    productionValidation: payload.productionValidation || null,
    runtimeState: payload.runtimeState || null,
    stack: payload.stack || null,
    ambiguousBetween: payload.ambiguousBetween || [],
  };
}

function passRate(passed, total) {
  return total === 0 ? 0 : Math.round((passed / total) * 1000) / 10;
}

function statusForStats(stats) {
  if (stats.failed === 0) return "PASS";
  const rate = passRate(stats.passed, stats.total);
  if (rate >= 85) return "STRONG_WITH_GAPS";
  if (rate >= 70) return "USABLE_WITH_GAPS";
  return "NEEDS_WORK";
}

function failureSummary(result) {
  if (!result.failures || result.failures.length === 0) return "";
  return truncate(result.failures.join("; "), 220);
}

function truncate(value, maxLength) {
  const text = String(value || "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function escapeMarkdownCell(value) {
  return String(value ?? "")
    .replace(/\r?\n/g, "<br>")
    .replace(/\|/g, "\\|");
}

function markdownRow(cells) {
  return `| ${cells.map(escapeMarkdownCell).join(" | ")} |`;
}

function artifactPreview(result) {
  const artifacts = result.artifacts || [];
  if (artifacts.length === 0) return "";
  const preview = artifacts.slice(0, 5).join(", ");
  return artifacts.length > 5 ? `${preview}, ...` : preview;
}

function buildMarkdownReport(report) {
  const { generatedAt, metadata, summary, conclusion, results } = report;
  const failed = results.filter((item) => !item.passed);
  const lines = [];

  lines.push("# Clink Integration Skill Evaluation Report");
  lines.push("");
  lines.push(`Generated at: ${generatedAt}`);
  lines.push(`Target skill: ${summary.skillRoot}`);
  lines.push(`Matrix: ${metadata.name || "unknown"} v${metadata.version ?? "unknown"}`);
  lines.push("");
  lines.push("## Executive Conclusion");
  lines.push("");
  lines.push(markdownRow(["Metric", "Value"]));
  lines.push(markdownRow(["---", "---"]));
  lines.push(markdownRow(["Overall status", conclusion.status]));
  lines.push(markdownRow(["Score", conclusion.score]));
  lines.push(markdownRow(["Passed", summary.passed]));
  lines.push(markdownRow(["Failed", summary.failed]));
  lines.push("");
  lines.push(conclusion.headline);
  lines.push("");
  lines.push("Strengths:");
  for (const item of conclusion.strengths.length > 0 ? conclusion.strengths : ["No category fully passed."]) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push("Priority gaps:");
  for (const item of conclusion.priorityAreas.length > 0 ? conclusion.priorityAreas : ["No priority gaps."]) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push("Recommended next fixes:");
  for (const item of conclusion.recommendedFixes.length > 0 ? conclusion.recommendedFixes : ["No fixes required."]) {
    lines.push(`- ${item}`);
  }
  lines.push("");

  lines.push("## Category Summary");
  lines.push("");
  lines.push(markdownRow(["Category", "Passed", "Failed", "Total", "Pass Rate", "Status"]));
  lines.push(markdownRow(["---", "---:", "---:", "---:", "---:", "---"]));
  for (const [category, stats] of Object.entries(summary.categoryStats)) {
    lines.push(markdownRow([
      category,
      stats.passed,
      stats.failed,
      stats.total,
      `${passRate(stats.passed, stats.total)}%`,
      statusForStats(stats),
    ]));
  }
  lines.push("");

  lines.push("## Route Summary");
  lines.push("");
  lines.push(markdownRow(["Route", "Passed", "Failed", "Total", "Pass Rate"]));
  lines.push(markdownRow(["---", "---:", "---:", "---:", "---:"]));
  for (const [route, stats] of Object.entries(summary.routeStats)) {
    lines.push(markdownRow([
      route,
      stats.passed,
      stats.failed,
      stats.total,
      `${passRate(stats.passed, stats.total)}%`,
    ]));
  }
  lines.push("");

  lines.push("## Failed Cases And Suggested Fixes");
  lines.push("");
  if (failed.length === 0) {
    lines.push("All cases passed.");
  } else {
    lines.push(markdownRow(["Category", "Case", "Capability", "Actual Route", "Failure Summary", "Suggested Fix"]));
    lines.push(markdownRow(["---", "---", "---", "---", "---", "---"]));
    for (const result of failed) {
      lines.push(markdownRow([
        result.category,
        result.id,
        result.capability,
        result.route,
        failureSummary(result),
        recommendCaseFix(result),
      ]));
    }
  }
  lines.push("");

  lines.push("## Full Case Results");
  lines.push("");
  lines.push(markdownRow(["Status", "Category", "Case", "Capability", "Route", "Environment", "Docs Gate", "Artifacts"]));
  lines.push(markdownRow(["---", "---", "---", "---", "---", "---", "---", "---"]));
  for (const result of results) {
    lines.push(markdownRow([
      result.passed ? "PASS" : "FAIL",
      result.category,
      result.id,
      result.capability,
      result.route,
      result.environment || "",
      result.docsGateInvoked ? "yes" : "no",
      artifactPreview(result),
    ]));
  }
  lines.push("");

  lines.push("## Evaluation Standards");
  lines.push("");
  for (const standard of metadata.standards || []) {
    lines.push(`- ${standard}`);
  }
  lines.push("");
  lines.push("Raw JSON remains available beside this report for automation and diffing.");
  lines.push("");

  return lines.join("\n");
}

function printHuman(summary, conclusion, results, reportPath, markdownReportPath) {
  console.log(`Comprehensive capability evaluation: ${summary.passed}/${summary.total} passed (${summary.passRate}%)`);
  console.log(`Target skill: ${summary.skillRoot}`);
  console.log(`Conclusion: ${conclusion.status} - ${conclusion.headline}`);
  console.log("\nCategory results:");
  for (const [category, stats] of Object.entries(summary.categoryStats)) {
    console.log(`- ${category}: ${stats.passed}/${stats.total} passed`);
  }
  console.log("\nRoute results:");
  for (const [route, stats] of Object.entries(summary.routeStats)) {
    console.log(`- ${route}: ${stats.passed}/${stats.total} passed`);
  }

  const failed = results.filter((item) => !item.passed);
  if (failed.length > 0) {
    console.log("\nFailures:");
    for (const item of failed) {
      console.log(`- ${item.id} [${item.category} / ${item.capability}]`);
      for (const failure of item.failures) console.log(`  - ${failure}`);
    }
  }

  console.log(`\nJSON report: ${reportPath}`);
  console.log(`Markdown report: ${markdownReportPath}`);
}

async function main() {
  const options = parseArgs(process.argv);
  ensureFile(options.casesPath, "case matrix");
  const skillRoot = path.resolve(options.skillRoot);
  const runtime = await loadSkillRuntime(skillRoot);
  const suite = JSON.parse(fs.readFileSync(options.casesPath, "utf8"));
  const docsFallbackSource = defaultDocsFallback(skillRoot);
  const results = [];

  for (const testCase of suite.cases || []) {
    const payload = await runtime.runSkillRuntime({
      prompt: testCase.prompt,
      contextBlocks: testCase.contextBlocks || [],
      docsFallbackSource,
      validationInput: testCase.validationInput || null,
      semanticValidation: testCase.semanticValidation || {},
      skipValidation: testCase.skipValidation === true,
    });

    const failures = evaluateCase(testCase, payload);
    results.push({
      id: testCase.id,
      category: testCase.category,
      capability: testCase.capability,
      passed: failures.length === 0,
      failures,
      ...compactPayload(payload),
    });
  }

  const summary = summarize(results, suite.metadata || {}, skillRoot);
  const conclusion = buildConclusion(summary, results);
  const report = {
    generatedAt: new Date().toISOString(),
    metadata: suite.metadata || {},
    summary,
    conclusion,
    results,
  };

  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.writeFileSync(options.reportPath, JSON.stringify(report, null, 2), "utf8");
  fs.mkdirSync(path.dirname(options.markdownReportPath), { recursive: true });
  fs.writeFileSync(options.markdownReportPath, buildMarkdownReport(report), "utf8");

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(summary, conclusion, results, options.reportPath, options.markdownReportPath);
  }

  if (!options.noFail && summary.failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
