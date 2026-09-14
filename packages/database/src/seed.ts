import * as dotenv from 'dotenv';
import * as path from 'path';

// Load root .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

import { createDb } from './index';
import {
  organizations,
  roles,
  users,
  userRoles,
  teams,
  teamMembers,
  projects,
  projectMembers,
  projectSettings,
  labels,
  issues,
  issueLabels,
  issueComments,
  activities,
} from './schema';

async function seed() {
  console.log('🌱 Starting database seed for ProjectFlow...');
  const db = createDb();

  const orgId = '00000000-0000-0000-0000-000000000001';
  const roleId = '00000000-0000-0000-0000-000000000002';
  const teamId = '00000000-0000-0000-0000-000000000003';
  const projectId = '11111111-1111-1111-1111-111111111111';

  const devUserId = '11111111-0000-0000-0000-000000000001';
  const alexUserId = '22222222-0000-0000-0000-000000000002';
  const sarahUserId = '33333333-0000-0000-0000-000000000003';
  const michaelUserId = '44444444-0000-0000-0000-000000000004';

  // 1. Organization
  console.log('Inserting Organization...');
  await db
    .insert(organizations)
    .values({
      id: orgId,
      name: 'Acme Engineering',
      slug: 'acme-engineering',
    })
    .onConflictDoUpdate({
      target: organizations.id,
      set: { name: 'Acme Engineering', updatedAt: new Date() },
    });

  // 2. Role
  console.log('Inserting Role...');
  await db
    .insert(roles)
    .values({
      id: roleId,
      organizationId: orgId,
      name: 'ADMIN',
      description: 'Organization Administrator',
    })
    .onConflictDoNothing();

  // 3. Users
  console.log('Inserting Users & Roles...');
  const seedUsers = [
    {
      id: devUserId,
      name: 'Dev Lead',
      email: 'dev@projectflow.local',
      avatarUrl: null,
    },
    {
      id: alexUserId,
      name: 'Alex Rivera',
      email: 'alex.rivera@projectflow.dev',
      avatarUrl: null,
    },
    {
      id: sarahUserId,
      name: 'Sarah Chen',
      email: 'sarah.chen@projectflow.dev',
      avatarUrl: null,
    },
    {
      id: michaelUserId,
      name: 'Michael Scott',
      email: 'michael@projectflow.dev',
      avatarUrl: null,
    },
  ];

  for (const u of seedUsers) {
    await db
      .insert(users)
      .values(u)
      .onConflictDoUpdate({
        target: users.id,
        set: { name: u.name, email: u.email },
      });

    await db
      .insert(userRoles)
      .values({
        userId: u.id,
        organizationId: orgId,
        roleId: roleId,
      })
      .onConflictDoNothing();
  }

  // 4. Team
  console.log('Inserting Team & Team Members...');
  await db
    .insert(teams)
    .values({
      id: teamId,
      organizationId: orgId,
      name: 'Core Platform',
      key: 'PLAT',
      description: 'Core infrastructure and platform payment services',
    })
    .onConflictDoNothing();

  for (const u of seedUsers) {
    await db
      .insert(teamMembers)
      .values({
        teamId: teamId,
        userId: u.id,
        role: u.id === devUserId ? 'LEAD' : 'MEMBER',
      })
      .onConflictDoNothing();
  }

  // 5. Project
  console.log('Inserting Project...');
  await db
    .insert(projects)
    .values({
      id: projectId,
      organizationId: orgId,
      teamId: teamId,
      key: 'PAY',
      name: 'Payment Integration Platform',
      description: 'Unified checkout and global payment gateway migration across multi-currency channels.',
      leadId: devUserId,
      healthStatus: 'HEALTHY',
      issueCounter: 4,
    })
    .onConflictDoUpdate({
      target: projects.id,
      set: {
        name: 'Payment Integration Platform',
        issueCounter: 4,
        updatedAt: new Date(),
      },
    });

  // 6. Project Members
  console.log('Inserting Project Members...');
  for (const u of seedUsers) {
    await db
      .insert(projectMembers)
      .values({
        projectId: projectId,
        userId: u.id,
        role: u.id === devUserId ? 'LEAD' : 'CONTRIBUTOR',
      })
      .onConflictDoNothing();
  }

  // 7. Project Settings
  console.log('Inserting Project Settings...');
  await db
    .insert(projectSettings)
    .values({
      projectId: projectId,
      workflowStatuses: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'],
      issueTypes: ['TASK', 'BUG', 'STORY', 'EPIC'],
      settingsJson: { defaultPriority: 'P2' },
    })
    .onConflictDoNothing();

  // 8. Labels
  console.log('Inserting Labels...');
  const l1Id = '00000000-0000-0000-0000-000000000011';
  const l2Id = '00000000-0000-0000-0000-000000000012';
  const l3Id = '00000000-0000-0000-0000-000000000013';

  await db
    .insert(labels)
    .values([
      { id: l1Id, projectId, name: 'Payments', color: '#3b82f6', description: 'Core payment processing' },
      { id: l2Id, projectId, name: 'Security', color: '#ef4444', description: 'Security and signature verification' },
      { id: l3Id, projectId, name: 'Frontend', color: '#10b981', description: 'Client UI and localized formatting' },
    ])
    .onConflictDoNothing();

  // 9. Issues
  console.log('Inserting Issues...');
  const seedIssues = [
    {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      projectId,
      issueKey: 'PAY-1',
      keyNumber: 1,
      title: 'Implement Stripe webhook signature verification and idempotency layer',
      description:
        'We must verify all incoming Stripe signatures using the endpoint secret and store event IDs in Redis with a 24-hour TTL to prevent double charges on retried webhooks.',
      type: 'TASK',
      status: 'IN_PROGRESS',
      priority: 'P0',
      storyPoints: 5,
      estimateHours: 12,
      dueDate: new Date(Date.now() + 86400000 * 3),
      assigneeId: alexUserId,
      reporterId: devUserId,
      isArchived: false,
    },
    {
      id: 'e27b233a-69f8-4b72-9c12-3f89012a4567',
      projectId,
      issueKey: 'PAY-2',
      keyNumber: 2,
      title: 'Fix race condition during concurrent checkout session generation',
      description:
        'Users experiencing duplicate checkout sessions when rapidly double-clicking the checkout button. Need optimistic button lock and idempotency header.',
      type: 'BUG',
      status: 'TODO',
      priority: 'P1',
      storyPoints: 3,
      estimateHours: 8,
      dueDate: new Date(Date.now() + 86400000 * 5),
      assigneeId: sarahUserId,
      reporterId: devUserId,
      isArchived: false,
    },
    {
      id: 'd16c122b-58ee-4a61-8b01-2e78901b3456',
      projectId,
      issueKey: 'PAY-3',
      keyNumber: 3,
      title: 'Multi-currency settlement pricing display for APAC region',
      description:
        'Support automatic currency conversion for AUD, NZD, and JPY currencies with localized decimal precision in checkout modal.',
      type: 'STORY',
      status: 'IN_REVIEW',
      priority: 'P2',
      storyPoints: 8,
      estimateHours: 20,
      dueDate: new Date(Date.now() + 86400000 * 10),
      assigneeId: michaelUserId,
      reporterId: devUserId,
      isArchived: false,
    },
    {
      id: 'c05b011a-47dd-3950-7a90-1d67890a2345',
      projectId,
      issueKey: 'PAY-4',
      keyNumber: 4,
      title: 'Audit trail logging for high-value transactions (> $10,000)',
      description:
        'Compliance requires full audit logs with IP, user agent, timestamp, and signature validation recorded in secure cold storage.',
      type: 'TASK',
      status: 'DONE',
      priority: 'P2',
      storyPoints: 3,
      estimateHours: 6,
      dueDate: new Date(Date.now() - 86400000 * 2),
      assigneeId: alexUserId,
      reporterId: alexUserId,
      isArchived: false,
    },
  ];

  for (const iss of seedIssues) {
    await db
      .insert(issues)
      .values(iss)
      .onConflictDoUpdate({
        target: issues.id,
        set: {
          title: iss.title,
          status: iss.status,
          priority: iss.priority,
          description: iss.description,
          updatedAt: new Date(),
        },
      });
  }

  // 10. Issue Labels
  console.log('Inserting Issue Labels...');
  await db
    .insert(issueLabels)
    .values([
      { issueId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', labelId: l1Id },
      { issueId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', labelId: l2Id },
      { issueId: 'e27b233a-69f8-4b72-9c12-3f89012a4567', labelId: l1Id },
      { issueId: 'd16c122b-58ee-4a61-8b01-2e78901b3456', labelId: l3Id },
      { issueId: 'c05b011a-47dd-3950-7a90-1d67890a2345', labelId: l2Id },
    ])
    .onConflictDoNothing();

  // 11. Comments
  console.log('Inserting Comments...');
  await db
    .insert(issueComments)
    .values([
      {
        issueId: 'c05b011a-47dd-3950-7a90-1d67890a2345',
        userId: alexUserId,
        content: 'Audit log format has been certified SAIF/SOC-2 compliant and tests pass.',
      },
      {
        issueId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        userId: devUserId,
        content: 'Added Stripe webhook test fixtures in staging environment.',
      },
    ])
    .onConflictDoNothing();

  // 12. Activity
  console.log('Inserting Activity Log...');
  await db
    .insert(activities)
    .values([
      {
        organizationId: orgId,
        projectId: projectId,
        userId: devUserId,
        entityType: 'PROJECT',
        entityId: projectId,
        action: 'CREATED',
        details: { message: 'Initialized Payment Integration Platform project' },
      },
    ])
    .onConflictDoNothing();

  console.log('✅ Database successfully seeded with Acme Engineering, Payment Integration Platform (PAY), 4 issues, comments, and members!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Error during database seed:', err);
  process.exit(1);
});
