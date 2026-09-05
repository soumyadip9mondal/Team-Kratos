const ALL_TOOLS = [
  {
    name: 'getEmployeeDocumentStatus',
    description: 'Check the onboarding document verification status and missing document requirements for an employee.',
    parameters: {
      type: 'OBJECT',
      properties: {
        employeeNameOrId: { type: 'STRING', description: 'Name or ID of the employee' }
      },
      required: ['employeeNameOrId']
    }
  },
  {
    name: 'checkOnboardingRequirements',
    description: 'Check tenant-configured required onboarding document policy and missing items for an onboarding employee.',
    parameters: {
      type: 'OBJECT',
      properties: {
        employeeNameOrId: { type: 'STRING', description: 'Name or ID of the employee' }
      },
      required: ['employeeNameOrId']
    }
  },
  {
    name: 'analyzeEmployeeDocument',
    description: 'Analyze an uploaded employee onboarding document to extract structured evidence, PII-masked numbers, confidence score, and consistency warnings.',
    parameters: {
      type: 'OBJECT',
      properties: {
        documentId: { type: 'STRING', description: 'The unique UUID of the OnboardingDocument' }
      },
      required: ['documentId']
    }
  },
  {
    name: 'draftActionForApproval',
    description: 'Use this tool WHENEVER the user asks you to perform a state-changing action (e.g. "add a new employee", "schedule a shift", "post an announcement", "approve leave", "reject leave"). You cannot execute these directly. Instead, draft the exact action parameters for the HR Manager to approve safely. ALLOWED_ACTIONS: [ROSTER_ADJUSTMENT, ADD_EMPLOYEE, CREATE_ANNOUNCEMENT, APPROVE_LEAVE, REJECT_LEAVE]. For ADD_EMPLOYEE, you MUST provide email, displayName, customRole, and officeName. For CREATE_ANNOUNCEMENT, you MUST provide title, category, and message. For APPROVE_LEAVE or REJECT_LEAVE, you MUST provide leaveId (uuid) and optionally adminRemarks. For ROSTER_ADJUSTMENT, you MUST provide planId (string). IMPORTANT: If you need a leaveId or planId, you should search/generate it first. DO NOT hallucinate fake data.',
    parameters: {
      type: 'OBJECT',
      properties: {
        actionType: { type: 'STRING', description: 'The exact type of action. MUST be one of: ADD_EMPLOYEE, ROSTER_ADJUSTMENT, CREATE_ANNOUNCEMENT, APPROVE_LEAVE, REJECT_LEAVE' },
        actionParameters: { type: 'OBJECT', description: 'The JSON payload containing all the parameters needed to execute the action. For APPROVE_LEAVE/REJECT_LEAVE: leaveId and adminRemarks. For ROSTER_ADJUSTMENT: planId.' },
        justification: { type: 'STRING', description: 'Your explanation to the HR Manager why this action is being proposed based on the chat.' }
      },
      required: ['actionType', 'actionParameters', 'justification']
    }
  },
  {
    name: 'searchHRPolicies',
    description: 'Search company HR policies, handbooks, and announcements using semantic search.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'The search query (e.g., "leave encashment policy")' }
      },
      required: ['query'],
    }
  },
  {
    name: 'getEmployeeProfile',
    description: 'Get detailed profile of a specific employee.',
    parameters: {
      type: 'OBJECT',
      properties: {
        employeeNameOrId: { type: 'STRING', description: 'Name or exact ID of the employee' }
      },
      required: ['employeeNameOrId'],
    }
  },
  {
    name: 'searchEmployees',
    description: 'Search for employees by department, designation, or status.',
    parameters: {
      type: 'OBJECT',
      properties: {
        department: { type: 'STRING', description: 'Optional department filter' },
        designation: { type: 'STRING', description: 'Optional designation filter' },
        status: { type: 'STRING', description: 'Optional status filter (e.g. "ACTIVE")' }
      }
    }
  },
  {
    name: 'getAttendanceSummary',
    description: 'Get attendance summary over a period of time, optionally filtered by employee or department.',
    parameters: {
      type: 'OBJECT',
      properties: {
        startDate: { type: 'STRING', description: 'Start date in YYYY-MM-DD' },
        endDate: { type: 'STRING', description: 'End date in YYYY-MM-DD' },
        department: { type: 'STRING', description: 'Optional department filter' },
        employeeNameOrId: { type: 'STRING', description: 'Optional employee filter' }
      },
      required: ['startDate', 'endDate']
    }
  },
  {
    name: 'analyzeLeaveAttachment',
    description: 'Use this tool to visually analyze and read the contents of an image or PDF document attached to a leave request. You MUST use this tool if the user asks you to verify or review an attached document.',
    parameters: {
      type: 'OBJECT',
      properties: {
        leaveId: { type: 'STRING', description: 'The exact ID of the leave request whose attachment needs to be analyzed.' }
      },
      required: ['leaveId']
    }
  },
  {
    name: 'generateRosterPlan',
    description: 'Generates a simulated shift roster plan for a given week and department. Returns the plan details and a planId which can be used to execute a ROSTER_ADJUSTMENT.',
    parameters: {
      type: 'OBJECT',
      properties: {
        weekISO: { type: 'STRING', description: 'The ISO date for the start of the week (YYYY-MM-DD)' },
        department: { type: 'STRING', description: 'Optional department name to isolate the simulation to.' }
      },
      required: ['weekISO']
    }
  },
  {
    name: 'getAbsenteesToday',
    description: 'Get list of employees who are absent today.',
    parameters: {
      type: 'OBJECT',
      properties: {
        department: { type: 'STRING', description: 'Optional department filter' }
      }
    }
  },
  {
    name: 'getShiftAssignments',
    description: 'Get the shift roster/assignments for employees on a specific date (defaults to today). Shows who is assigned to which shift, and when their shift block starts and ends.',
    parameters: {
      type: 'OBJECT',
      properties: {
        dateISO: { type: 'STRING', description: 'The ISO date (YYYY-MM-DD). If omitted, defaults to today.' }
      }
    }
  },
  {
    name: 'assignEmployeeToShift',
    description: 'Directly assign a specific employee to a specific shift type on a specific date. Use this when the user says things like "assign [name] to [shift] on [date]", "put [name] on night shift on [date]", or "can [name] do [shift] on [date]". This does NOT require approval — it executes immediately. For bulk/weekly roster generation, use generateRosterPlan instead.',
    parameters: {
      type: 'OBJECT',
      properties: {
        employeeNameOrId: { type: 'STRING', description: 'The name or ID of the employee to assign.' },
        shiftType: { type: 'STRING', description: 'The exact shift type name (e.g. "Night Shift", "Day Shift"). Look at existing shifts for exact names.' },
        dateISO: { type: 'STRING', description: 'The date for the assignment in YYYY-MM-DD format.' }
      },
      required: ['employeeNameOrId', 'shiftType', 'dateISO']
    }
  },
  {
    name: 'getLeaveRequests',
    description: 'Get leave requests for a given period.',
    parameters: {
      type: 'OBJECT',
      properties: {
        status: { type: 'STRING', description: 'Leave status: PENDING, APPROVED, REJECTED' },
        startDate: { type: 'STRING', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'STRING', description: 'End date (YYYY-MM-DD)' }
      }
    }
  },
  {
    name: 'getEmployeesOnLeaveToday',
    description: 'Get list of employees currently on leave today.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'getDepartmentMetrics',
    description: 'Get aggregated metrics (attendance, leave) for a department.',
    parameters: {
      type: 'OBJECT',
      properties: {
        department: { type: 'STRING', description: 'Department name' },
        month: { type: 'STRING', description: 'Month in YYYY-MM format' }
      },
      required: ['department', 'month']
    }
  },
  {
    name: 'getLeavePolicies',
    description: 'Get all configured leave policies for the company from the database — quotas, carry-forward rules, paid/unpaid status, etc.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'getPayrollSummary',
    description: 'Get payroll summary for a given month. SENSITIVE: requires Level 0 or 1 permissions.',
    parameters: {
      type: 'OBJECT',
      properties: {
        month: { type: 'STRING', description: 'Month in YYYY-MM format' },
        department: { type: 'STRING', description: 'Optional department filter' }
      },
      required: ['month']
    }
  },
  {
    name: 'getAttritionRiskList',
    description: 'Get employees flagged for high attrition risk. SENSITIVE: requires Level 0 or 1 permissions.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'getPendingApprovals',
    description: 'Get summary of all pending approvals (leaves, expenses, salary advances).',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'getFraudAlertSummary',
    description: 'Get a summary of fraud/proxy alerts over a time period, optionally filtered by severity, status, alertType, departmentId, or userId. SENSITIVE: requires Level 0 or 1 permissions.',
    parameters: {
      type: 'OBJECT',
      properties: {
        startDate: { type: 'STRING', description: 'Start date in YYYY-MM-DD' },
        endDate: { type: 'STRING', description: 'End date in YYYY-MM-DD' },
        severity: { type: 'STRING', description: 'Severity level: HIGH, MEDIUM, LOW' },
        status: { type: 'STRING', description: 'Status: OPEN, RESOLVED' },
        alertType: { type: 'STRING', description: 'Type of alert (e.g. ATTENDANCE, PROXY)' },
        departmentId: { type: 'STRING', description: 'Department filter ID' },
        userId: { type: 'STRING', description: 'Optional employee user ID' }
      }
    }
  },
  {
    name: 'getTopCandidatesForJob',
    description: 'Get the top ranking candidates for a specific job requisition based on ATS match score.',
    parameters: {
      type: 'OBJECT',
      properties: {
        jobTitle: { type: 'STRING', description: 'Title of the job role (e.g. "Senior Frontend Engineer")' }
      },
      required: ['jobTitle']
    }
  },
  {
    name: 'getInterviewingCandidatesForJob',
    description: 'Get the candidates who are currently in the Interview stage for a specific job role.',
    parameters: {
      type: 'OBJECT',
      properties: {
        jobTitle: { type: 'STRING', description: 'Title of the job role (e.g. "Senior Frontend Engineer")' }
      },
      required: ['jobTitle']
    }
  },
  {
    name: 'getOfferedCandidatesForJob',
    description: 'Get the candidates who have been offered a specific job role.',
    parameters: {
      type: 'OBJECT',
      properties: {
        jobTitle: { type: 'STRING', description: 'Title of the job role (e.g. "Senior Frontend Engineer")' }
      },
      required: ['jobTitle']
    }
  },
  {
    name: 'getHiredCandidatesForJob',
    description: 'Get the candidates who have been hired for a specific job role.',
    parameters: {
      type: 'OBJECT',
      properties: {
        jobTitle: { type: 'STRING', description: 'Title of the job role (e.g. "Senior Frontend Engineer")' }
      },
      required: ['jobTitle']
    }
  },
  {
    name: 'getCandidateATSScore',
    description: 'Get the detailed ATS match score and evidence for a specific candidate for a job role.',
    parameters: {
      type: 'OBJECT',
      properties: {
        candidateName: { type: 'STRING', description: 'Name of the candidate' },
        jobTitle: { type: 'STRING', description: 'Optional title of the job role to scope the search' }
      },
      required: ['candidateName']
    }
  },
  {
    name: 'runWorkforceScenario',
    description: 'Runs a deterministic workforce planning projection based on factual data and explicit assumptions. Use this when the user asks "what if..." questions about headcount or costs.',
    parameters: {
      type: 'OBJECT',
      properties: {
        action: { type: 'STRING', description: 'The scenario action. E.g., "ADD_HEADCOUNT", "REDUCE_OVERTIME"' },
        departmentId: { type: 'STRING', description: 'The target department, e.g., "engineering", "sales". Defaults to GLOBAL if omitted.' },
        count: { type: 'INTEGER', description: 'The numeric count associated with the action (e.g. 3 for hiring 3 people)' },
        overtimeReductionAssumption: { type: 'NUMBER', description: 'If the user specifies a percentage reduction in overtime, express as a decimal (e.g., 0.19 for 19%)' },
        inputMetricVersion: { type: 'STRING', description: 'The time period to use as the baseline snapshot (e.g. "2026-08")' }
      },
      required: ['action', 'inputMetricVersion']
    }
  },
  {
    name: 'getOpenJobs',
    description: 'Lists all open job requisitions/vacancies in the company.',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'getOpenTickets',
    description: 'Lists all open or in-progress helpdesk tickets.',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'getPendingExpenses',
    description: 'Lists pending expense claims that need approval.',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'getEmployeeAssets',
    description: 'Lists the physical assets (e.g. laptops, monitors) assigned to a specific employee.',
    parameters: {
      type: 'OBJECT',
      properties: { employeeNameOrId: { type: 'STRING' } },
      required: ['employeeNameOrId']
    }
  },
  {
    name: 'getEmployeeGoals',
    description: 'Lists the performance goals for a specific employee.',
    parameters: {
      type: 'OBJECT',
      properties: {
        employeeNameOrId: { type: 'STRING', description: 'Name or exact ID of the employee' }
      },
      required: ['employeeNameOrId']
    }
  },
  {
    name: 'getDepartmentCostMetrics',
    description: 'Retrieves factual cost metrics (payroll, overtime) and estimated costs (absence) for a specific department. Also detects cost anomalies against a baseline.',
    parameters: {
      type: 'OBJECT',
      properties: {
        departmentName: { type: 'STRING', description: 'Name of the department (e.g., "Engineering")' },
        period: { type: 'STRING', description: 'The current period to analyze in YYYY-MM format (e.g., "2026-08")' },
        baselinePeriod: { type: 'STRING', description: 'The baseline period to compare against in YYYY-MM format (e.g., "2026-07")' }
      },
      required: ['departmentName', 'period', 'baselinePeriod']
    }
  }
];

// ── Domain → tool family mapping ─────────────────────────────────────
// Only expose the minimum required tools per domain.
// Never expose unrelated HR tools to Gemini.
const DOMAIN_TOOLS = {
  ATTENDANCE: ['getAbsenteesToday', 'getAttendanceSummary', 'searchEmployees', 'draftActionForApproval', 'getShiftAssignments', 'generateRosterPlan', 'assignEmployeeToShift'],
  LEAVE:      ['getLeaveRequests', 'getEmployeesOnLeaveToday', 'getLeavePolicies', 'analyzeLeaveAttachment'],
  PAYROLL:    ['getPayrollSummary'],
  EMPLOYEE:   ['getEmployeeProfile', 'searchEmployees', 'getEmployeeAssets', 'getEmployeeGoals', 'draftActionForApproval', 'getShiftAssignments', 'generateRosterPlan', 'assignEmployeeToShift'],
  POLICY:     ['getLeavePolicies', 'searchHRPolicies'],
  ANALYTICS:  ['getAttendanceSummary', 'getDepartmentMetrics', 'getAttritionRiskList', 'runWorkforceScenario', 'getPendingExpenses', 'getOpenTickets', 'getDepartmentCostMetrics'],
  APPROVALS:  ['getPendingApprovals', 'getPendingExpenses'],
  ALERTS:     ['getFraudAlertSummary'],
  RISK:       ['runWorkforceScenario'],
  RECRUITMENT: ['getTopCandidatesForJob', 'getInterviewingCandidatesForJob', 'getOfferedCandidatesForJob', 'getHiredCandidatesForJob', 'getCandidateATSScore', 'getOpenJobs']
};

/**
 * Returns only the tools relevant to a specific domain.
 * Gemini must never see unrelated tools.
 * Priority 1: server-side execution. This is fallback (Priority 2).
 */
function getToolsByDomain(domain) {
  const allowed = DOMAIN_TOOLS[domain] || [];
  if (!allowed.includes('draftActionForApproval')) {
    allowed.push('draftActionForApproval');
  }
  return ALL_TOOLS.filter(t => allowed.includes(t.name));
}

/**
 * Legacy helper kept for any callers that may still reference it.
 * Maps old intent names to domain-scoped tools.
 */
function getCandidateToolsByIntent(intent) {
  if (intent === 'POLICY') return getToolsByDomain('POLICY');
  if (intent === 'LIVE_DATA') return ALL_TOOLS.filter(t => t.name !== 'searchHRPolicies');
  return ALL_TOOLS; // HYBRID / fallback
}

module.exports = { ALL_TOOLS, getToolsByDomain, getCandidateToolsByIntent };
