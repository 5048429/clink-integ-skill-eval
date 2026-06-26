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
  return {
    json: args.includes("--json"),
    noFail: args.includes("--no-fail"),
    skillRoot: valueAfter(args, "--skill-root") || process.env.CLINK_SKILL_ROOT || defaultSkillRoot,
    casesPath: valueAfter(args, "--cases") || defaultCasesPath,
    reportPath: valueAfter(args, "--report") || defaultReportPath,
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

function printHuman(summary, results, reportPath) {
  console.log(`Comprehensive capability evaluation: ${summary.passed}/${summary.total} passed (${summary.passRate}%)`);
  console.log(`Target skill: ${summary.skillRoot}`);
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

  console.log(`\nReport: ${reportPath}`);
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
  const report = {
    generatedAt: new Date().toISOString(),
    metadata: suite.metadata || {},
    summary,
    results,
  };

  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.writeFileSync(options.reportPath, JSON.stringify(report, null, 2), "utf8");

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(summary, results, options.reportPath);
  }

  if (!options.noFail && summary.failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
