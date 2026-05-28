
const userPreferences = {
  'user-123': { telegram: '@security_guard', email: 'guard@campus.edu' },
  'user-456': { email: 'admin@campus.edu' },
  'user-789': {}
};
const sendTelegram = async (userId, message) => {
  const pref = userPreferences[userId];
  if (!pref?.telegram) {
    throw new Error(`User ${userId} has no Telegram configured`);
  }
  console.log(`[TELEGRAM] Gửi tới ${pref.telegram}: ${message}`);
  return { success: true, channel: 'telegram', userId };
};

const sendEmail = async (userId, subject, body) => {
  const pref = userPreferences[userId];
  if (!pref?.email) {
    throw new Error(`User ${userId} has no email configured`);
  }
  console.log(`[EMAIL] Gửi tới ${pref.email}: ${subject} - ${body}`);
  return { success: true, channel: 'email', userId };
};
const processAlertCreated = async (event) => {
  const { data } = event;
  const { severity, userId, userGroupId, title, message } = data;
  const targetUserId = userId || userGroupId;
  
  if (!targetUserId) {
    throw new Error('Either userId or userGroupId is required (Issue #3)');
  }

  if (severity === 'CRITICAL' || severity === 'HIGH') {
    try {
      return await sendTelegram(targetUserId, `${title}: ${message}`);
    } catch (error) {
      console.log(`Telegram failed, fallback to email: ${error.message}`);
      return await sendEmail(targetUserId, title, message);
    }
  } 
  else {
    return await sendEmail(targetUserId, title, message);
  }
};
const validateEvent = (event) => {
  const errors = [];
  
  if (!event.eventId) errors.push('eventId is required (Issue #4)');
  
  if (!event.correlationId) errors.push('correlationId is required (Issue #2)');
  if (!event.traceId) errors.push('traceId is required (Issue #2)');
  
  if (!event.eventType) errors.push('eventType is required');
  if (!event.occurredAt) errors.push('occurredAt is required');
  if (!event.source) errors.push('source is required');
  if (!event.data) errors.push('data is required');
  
  if (event.data?.severity) {
    const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (!validSeverities.includes(event.data.severity)) {
      errors.push(`Invalid severity: ${event.data.severity} (Issue #1: must be LOW/MEDIUM/HIGH/CRITICAL)`);
    }
  }
  
  if (event.eventType === 'alert.created') {
    if (!event.data?.userId && !event.data?.userGroupId) {
      errors.push('Either userId or userGroupId is required for alert.created (Issue #3)');
    }
  }
  
  if (event.eventType === 'alert.resolved') {
    if (!event.data?.resolvedBy) {
      errors.push('resolvedBy is required for alert.resolved (Issue #5)');
    }
  }
  
  return { valid: errors.length === 0, errors };
};
const processedEventIds = new Set();
const isDuplicate = (eventId) => processedEventIds.has(eventId);
const markProcessed = (eventId) => processedEventIds.add(eventId);
const handleEvent = async (event) => {
  if (isDuplicate(event.eventId)) {
    console.log(`[SKIP] Duplicate event ${event.eventId} (Issue #4 - idempotency)`);
    return { status: 'skipped', reason: 'duplicate', issue: '#4' };
  }

  const validation = validateEvent(event);
  if (!validation.valid) {
    throw new Error(`Invalid event: ${validation.errors.join(', ')}`);
  }

  markProcessed(event.eventId);

  switch (event.eventType) {
    case 'alert.created':
      console.log(`[PROCESS] alert.created - ${event.eventId} (Issue #1, #3)`);
      return await processAlertCreated(event);
    case 'alert.escalated':
      console.log(`[ESCALATED] Alert ${event.data?.alertId} from ${event.data?.previousSeverity} to ${event.data?.newSeverity}`);
      return { status: 'processed', type: 'escalated', issue: '#2' };
    case 'alert.resolved':
      console.log(`[RESOLVED] Alert ${event.data?.alertId} by ${event.data?.resolvedBy} (Issue #5)`);
      return { status: 'processed', type: 'resolved', issue: '#5' };
    default:
      throw new Error(`Unknown event type: ${event.eventType}`);
  }
};

const validAlertCreated = {
  eventId: '550e8400-e29b-41d4-a716-446655440000',
  eventType: 'alert.created',
  occurredAt: '2026-05-20T08:30:00Z',
  correlationId: '660e8400-e29b-41d4-a716-446655440001',
  traceId: '770e8400-e29b-41d4-a716-446655440002',
  source: 'core-business',
  data: {
    alertId: '880e8400-e29b-41d4-a716-446655440003',
    severity: 'CRITICAL',
    userId: 'user-123',
    title: 'Phát hiện truy cập trái phép',
    message: 'Cửa chính - 20/05/2026 08:30'
  }
};

const validAlertEscalated = {
  eventId: '890e8400-e29b-41d4-a716-446655440004',
  eventType: 'alert.escalated',
  occurredAt: '2026-05-20T08:35:00Z',
  correlationId: '660e8400-e29b-41d4-a716-446655440001',
  traceId: '770e8400-e29b-41d4-a716-446655440002',
  source: 'core-business',
  data: {
    alertId: '880e8400-e29b-41d4-a716-446655440003',
    previousSeverity: 'MEDIUM',
    newSeverity: 'HIGH',
    reason: 'Chưa xử lý sau 5 phút'
  }
};

const validAlertResolved = {
  eventId: '900e8400-e29b-41d4-a716-446655440005',
  eventType: 'alert.resolved',
  occurredAt: '2026-05-20T09:00:00Z',
  correlationId: '660e8400-e29b-41d4-a716-446655440001',
  traceId: '770e8400-e29b-41d4-a716-446655440002',
  source: 'core-business',
  data: {
    alertId: '880e8400-e29b-41d4-a716-446655440003',
    resolvedBy: 'admin',
    resolutionNote: 'Đã xử lý xong'
  }
};

describe('Pair 04 - Queue Async Contract Tests (Based on negotiation-log.md)', () => {
  
  beforeEach(() => {
    processedEventIds.clear();
  });

  test('TC001 - Issue #1+#3: CRITICAL severity should send via Telegram', async () => {
    const result = await handleEvent(validAlertCreated);
    expect(result.success).toBe(true);
    expect(result.channel).toBe('telegram');
  });

  test('TC002 - Issue #4: Duplicate eventId should be skipped', async () => {
    await handleEvent(validAlertCreated);
    const duplicateResult = await handleEvent(validAlertCreated);
    expect(duplicateResult.status).toBe('skipped');
    expect(duplicateResult.reason).toBe('duplicate');
    expect(duplicateResult.issue).toBe('#4');
  });

  test('TC003 - Issue #2+#4: Missing eventId should be rejected', async () => {
    const invalidEvent = { ...validAlertCreated };
    delete invalidEvent.eventId;
    await expect(handleEvent(invalidEvent)).rejects.toThrow('eventId is required');
  });

  test('TC004 - Issue #1: Invalid severity should be rejected', async () => {
    const invalidEvent = {
      ...validAlertCreated,
      eventId: 'new-id-001',
      data: { ...validAlertCreated.data, severity: 'UNKNOWN' }
    };
    await expect(handleEvent(invalidEvent)).rejects.toThrow('Invalid severity');
  });

  test('TC005 - Issue #2: Missing correlationId should be rejected', async () => {
    const invalidEvent = { ...validAlertCreated, eventId: 'new-id-002' };
    delete invalidEvent.correlationId;
    await expect(handleEvent(invalidEvent)).rejects.toThrow('correlationId is required');
  });

  test('TC006 - Issue #5: alert.resolved should be processed', async () => {
    const result = await handleEvent(validAlertResolved);
    expect(result.status).toBe('processed');
    expect(result.type).toBe('resolved');
    expect(result.issue).toBe('#5');
  });

  test('TC007 - Issue #3: Missing userId/userGroupId should be rejected', async () => {
    const invalidEvent = {
      ...validAlertCreated,
      eventId: 'new-id-003',
      data: { ...validAlertCreated.data, userId: undefined, userGroupId: undefined }
    };
    await expect(handleEvent(invalidEvent)).rejects.toThrow('userId or userGroupId is required');
  });

  test('TC008 - Issue #3: User without Telegram should fallback to email', async () => {
    const event = {
      ...validAlertCreated,
      eventId: 'new-id-004',
      data: { ...validAlertCreated.data, severity: 'HIGH', userId: 'user-456' }
    };
    const result = await handleEvent(event);
    expect(result.success).toBe(true);
    expect(result.channel).toBe('email');
  });

  test('TC009 - Issue #2: alert.escalated should be processed', async () => {
    const result = await handleEvent(validAlertEscalated);
    expect(result.status).toBe('processed');
    expect(result.type).toBe('escalated');
  });

  test('TC010 - Issue #5: Missing resolvedBy should be rejected', async () => {
    const invalidEvent = {
      ...validAlertResolved,
      eventId: 'new-id-005',
      data: { ...validAlertResolved.data, resolvedBy: undefined }
    };
    await expect(handleEvent(invalidEvent)).rejects.toThrow('resolvedBy is required');
  });
});