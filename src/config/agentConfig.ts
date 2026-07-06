/**
 * agentConfig.ts — Feature flags and configuration for the AI automation system.
 *
 * Disable individual subsystems here without touching business logic.
 */

import type { ReasoningModeConfig } from "@/services/agents/types";

export const AGENT_CONFIG = {
  // ── Memory ─────────────────────────────────────────────────────────────────
  memory: {
    enabled: true,
    shortTermActionLimit: 50,
    longTermInsightLimit: 200,
    patternLimit: 100,
    consolidationIntervalMs: 6 * 60 * 60 * 1000, // 6 hours
    dbName: 'casebuddy_agent_memory',
    dbVersion: 1,
  },

  // ── Reasoning modes ────────────────────────────────────────────────────────
  reasoning: {
    standard: {
      enabled: true,
      maxTokens: 2048,
    } as ReasoningModeConfig,
    deepThink: {
      enabled: true,
      maxTokens: 4096,
      steps: 4,
      selfCritique: true,
    } as ReasoningModeConfig,
    expertPanel: {
      enabled: true,
      maxTokens: 2048,
      maxSpecialists: 3,
    } as ReasoningModeConfig,
    adversarial: {
      enabled: true,
      maxTokens: 3072,
      selfCritique: true,
    } as ReasoningModeConfig,
  },

  // ── Background task engine ─────────────────────────────────────────────────
  background: {
    enabled: true,
    schedulerIntervalMs: 2 * 60 * 1000, // 2 minutes
    maxConcurrentTasks: 3,
    taskTimeoutMs: 90_000,
    maxRetries: 2,
    resultRetentionMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  },

  // ── Case monitoring ────────────────────────────────────────────────────────
  monitoring: {
    enabled: true,
    checkIntervalMs: 5 * 60 * 1000, // 5 min
    rules: {
      deadlineAlerts: true,
      caseStrengthDrop: true,
      juryPrepReminder: true,
    },
  },

  // ── Notifications ──────────────────────────────────────────────────────────
  notifications: {
    enabled: true,
    batchIntervalMs: 3 * 60 * 1000, // 3 minutes
    maxBatchSize: 6,
    maxStored: 200,
    quietHoursStart: 22,
    quietHoursEnd: 7,
  },

  // ── Agent learning ─────────────────────────────────────────────────────────
  learning: {
    enabled: true,
    patternMinOccurrences: 3,
    patternConfidenceThreshold: 65,
  },

  // ── Cross-case intelligence ────────────────────────────────────────────────
  crossCase: {
    enabled: true,
    similarityThreshold: 50,
    maxSimilarCases: 8,
  },

  // ── Workflows ──────────────────────────────────────────────────────────────
  workflows: {
    enabled: true,
    autoTriggerIntake: true,
    trialPrepLeadDays: 30,
    juryPrepLeadDays: 14,
  },
} as const;
