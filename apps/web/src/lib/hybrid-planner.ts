import "server-only";

export type HybridExecution = "cloud" | "device";

export interface HybridPlanStep {
  label: string;
  agentTemplateId: string;
  execution: HybridExecution;
  requiredCapabilities: string[];
  taskType?: string;
  allowedActions?: string[];
  riskLevel?: 1 | 2 | 3;
  input?: Record<string, unknown>;
}

export interface HybridPlan {
  squad: "research" | "outbound" | "content" | "launch" | "seo" | "conversion";
  steps: HybridPlanStep[];
  estimatedCredits: number;
}

/**
 * V1.2 planner bootstrap.
 *
 * This intentionally produces a small deterministic graph before a model ever
 * sees the job. The cloud agents still perform reasoning/writing, but the
 * security boundary (which device capabilities/actions are required) is not
 * delegated to arbitrary model text.
 */
export function planHybridMission(
  instruction: string,
  requestedExecution: "auto" | "cloud" | "macos" | "android",
): HybridPlan {
  const text = instruction.toLowerCase();
  const wantsDevice = requestedExecution !== "cloud";

  if (/lead|founder|prospect|outreach/.test(text)) {
    const wantsSheet =
      /google\s*sheet|sheets|spreadsheet|save .*sheet|put .*sheet/.test(text);

    const steps: HybridPlanStep[] = [
      {
        label: "Research public founder and company sources",
        agentTemplateId: "research-agent",
        execution: wantsDevice ? "device" : "cloud",
        requiredCapabilities: wantsDevice ? ["browser_control"] : [],
        taskType: wantsDevice ? "browser.research" : undefined,
        allowedActions: wantsDevice
          ? ["open_url", "inspect_ui", "tap", "type", "scroll", "back"]
          : undefined,
        riskLevel: 1,
        input: { objective: instruction, evidenceRequired: true },
      },
      {
        label: wantsSheet
          ? "Qualify leads and prepare spreadsheet rows"
          : "Qualify leads against the founder's ICP",
        agentTemplateId: "lead-agent",
        execution: "cloud",
        requiredCapabilities: [],
        riskLevel: 1,
        input: wantsSheet
          ? {
              output_format: "tsv",
              output_contract:
                "Return only tab-separated rows with header: Founder\\tCompany\\tRole\\tFit reason\\tSource\\tConfidence. No markdown fence, no commentary.",
            }
          : {},
      },
    ];

    if (wantsSheet && wantsDevice) {
      steps.push({
        label: "Save qualified leads to Google Sheets",
        agentTemplateId: "lead-agent",
        execution: "device",
        requiredCapabilities: ["accessibility_control"],
        taskType: "sheets.write",
        allowedActions: ["open_app", "inspect_ui", "tap", "type", "back"],
        riskLevel: 2,
        input: {
          app: "com.google.android.apps.docs.editors.sheets",
          data_from_dependency: true,
          write_mode: "new_sheet",
        },
      });
    }

    steps.push(
      {
        label: "Draft personalized outreach",
        agentTemplateId: "outreach-agent",
        execution: "cloud",
        requiredCapabilities: [],
        riskLevel: 1,
      },
      {
        label: "Verify sources, duplicates and claims",
        agentTemplateId: "research-agent",
        execution: "cloud",
        requiredCapabilities: [],
        riskLevel: 1,
      },
    );

    return {
      squad: "outbound",
      estimatedCredits: wantsSheet ? 20 : 18,
      steps,
    };
  }

  if (/\\bx\\b|twitter|linkedin|content|post|reply|thread/.test(text)) {
    return {
      squad: "content",
      estimatedCredits: 14,
      steps: [
        {
          label: "Research current conversations and source material",
          agentTemplateId: "research-agent",
          execution: wantsDevice ? "device" : "cloud",
          requiredCapabilities: wantsDevice ? ["browser_control"] : [],
          taskType: wantsDevice ? "browser.research" : undefined,
          allowedActions: wantsDevice
            ? ["open_app", "open_url", "inspect_ui", "tap", "type", "scroll", "back"]
            : undefined,
          riskLevel: 1,
          input: { objective: instruction, evidenceRequired: true },
        },
        {
          label: "Draft original content and replies",
          agentTemplateId: "content-agent",
          execution: "cloud",
          requiredCapabilities: [],
          riskLevel: 1,
        },
        {
          label: "Quality-check claims and spam risk",
          agentTemplateId: "research-agent",
          execution: "cloud",
          requiredCapabilities: [],
          riskLevel: 1,
        },
      ],
    };
  }

  if (/launch|directory|distribution/.test(text)) {
    return {
      squad: "launch",
      estimatedCredits: 20,
      steps: [
        {
          label: "Research launch channels and current opportunities",
          agentTemplateId: "research-agent",
          execution: wantsDevice ? "device" : "cloud",
          requiredCapabilities: wantsDevice ? ["browser_control"] : [],
          taskType: wantsDevice ? "browser.research" : undefined,
          allowedActions: wantsDevice
            ? ["open_url", "inspect_ui", "tap", "type", "scroll", "back"]
            : undefined,
          riskLevel: 1,
          input: { objective: instruction, evidenceRequired: true },
        },
        {
          label: "Prepare launch distribution work",
          agentTemplateId: "content-agent",
          execution: "cloud",
          requiredCapabilities: [],
          riskLevel: 1,
        },
      ],
    };
  }

  if (/seo|keyword|search ranking|internal link/.test(text)) {
    return {
      squad: "seo",
      estimatedCredits: 16,
      steps: [
        {
          label: "Research search results, competitors and gaps",
          agentTemplateId: "seo-agent",
          execution: wantsDevice ? "device" : "cloud",
          requiredCapabilities: wantsDevice ? ["browser_control"] : [],
          taskType: wantsDevice ? "browser.research" : undefined,
          allowedActions: wantsDevice
            ? ["open_url", "inspect_ui", "tap", "type", "scroll", "back"]
            : undefined,
          riskLevel: 1,
          input: { objective: instruction, evidenceRequired: true },
        },
        {
          label: "Prepare SEO recommendations",
          agentTemplateId: "seo-agent",
          execution: "cloud",
          requiredCapabilities: [],
          riskLevel: 1,
        },
      ],
    };
  }

  if (/conversion|landing|checkout|funnel|pricing/.test(text)) {
    return {
      squad: "conversion",
      estimatedCredits: 12,
      steps: [
        {
          label: "Inspect the relevant funnel and pages",
          agentTemplateId: "landing-agent",
          execution: wantsDevice ? "device" : "cloud",
          requiredCapabilities: wantsDevice ? ["browser_control"] : [],
          taskType: wantsDevice ? "browser.research" : undefined,
          allowedActions: wantsDevice
            ? ["open_url", "inspect_ui", "tap", "scroll", "back"]
            : undefined,
          riskLevel: 1,
          input: { objective: instruction, evidenceRequired: true },
        },
        {
          label: "Analyze conversion opportunities",
          agentTemplateId: "analytics-agent",
          execution: "cloud",
          requiredCapabilities: [],
          riskLevel: 1,
        },
      ],
    };
  }

  return {
    squad: "research",
    estimatedCredits: 10,
    steps: [
      {
        label: "Research the goal and collect evidence",
        agentTemplateId: "research-agent",
        execution: wantsDevice ? "device" : "cloud",
        requiredCapabilities: wantsDevice ? ["browser_control"] : [],
        taskType: wantsDevice ? "browser.research" : undefined,
        allowedActions: wantsDevice
          ? ["open_url", "inspect_ui", "tap", "type", "scroll", "back"]
          : undefined,
        riskLevel: 1,
        input: { objective: instruction, evidenceRequired: true },
      },
      {
        label: "Verify and summarize the findings",
        agentTemplateId: "research-agent",
        execution: "cloud",
        requiredCapabilities: [],
        riskLevel: 1,
      },
    ],
  };
}
