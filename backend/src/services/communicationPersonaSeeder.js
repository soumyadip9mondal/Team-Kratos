/**
 * Communication Persona Seeder
 *
 * Idempotent seeder that provisions the 3 system default personas and
 * initial CommunicationReviewConfig for a tenant.
 *
 * Accepts either a Prisma transaction client (tx) or basePrisma instance.
 */

const SYSTEM_PERSONAS = [
  {
    key: 'senior_developer',
    name: 'Senior Developer',
    roleFamily: 'Engineering',
    focusAreas: ['Clarity', 'Workload', 'Delivery'],
    isSystem: true,
    isActive: true,
  },
  {
    key: 'hr_people_partner',
    name: 'HR / People Partner',
    roleFamily: 'Human Resources',
    focusAreas: ['Fairness', 'Tone', 'Workload'],
    isSystem: true,
    isActive: true,
  },
  {
    key: 'product_lead',
    name: 'Product Lead',
    roleFamily: 'Product',
    focusAreas: ['Clarity', 'Delivery', 'Workload'],
    isSystem: true,
    isActive: true,
  },
];

/**
 * Seed 3 system personas and default config for a tenant.
 * Safe to run multiple times (idempotent upsert).
 *
 * @param {object} prismaClient - tx or prisma.basePrisma
 * @param {string} tenantId
 */
const seed = async (prismaClient, tenantId) => {
  if (!tenantId) {
    throw new Error('[communicationPersonaSeeder] tenantId is required');
  }

  // 1. Seed CommunicationReviewConfig (default disabled)
  await prismaClient.communicationReviewConfig.upsert({
    where: { tenantId },
    update: {},
    create: {
      tenantId,
      enabled: false,
      policyContextEnabled: false,
      personaBuilderEnabled: false,
      analyticsEnabled: false,
      detailRetentionDays: 90,
    },
  });

  // 2. Seed System Personas
  for (const persona of SYSTEM_PERSONAS) {
    await prismaClient.communicationPersona.upsert({
      where: {
        tenantId_key: {
          tenantId,
          key: persona.key,
        },
      },
      update: {
        name: persona.name,
        roleFamily: persona.roleFamily,
        focusAreas: persona.focusAreas,
        isSystem: true,
        isActive: true,
      },
      create: {
        tenantId,
        key: persona.key,
        name: persona.name,
        roleFamily: persona.roleFamily,
        focusAreas: persona.focusAreas,
        isSystem: true,
        isActive: true,
      },
    });
  }
};

module.exports = {
  seed,
  SYSTEM_PERSONAS,
};
