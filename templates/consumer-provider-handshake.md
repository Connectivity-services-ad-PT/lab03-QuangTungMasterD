# Consumer–Provider Handshake

## Thông tin chung

- Lab: FIT4110 Lab 03
- Ngày: 27/05/2026
- Provider team: Notification Service - B7
- Consumer team: Core Business Service - B6
- Provider service: Notification Service
- Consumer service: Core Business Service

## Contract

- Contract file: `contracts/notification.openapi.yaml`
- Mock base URL: `http://localhost:4010`
- Auth method: Bearer token (JWT)
- Endpoint được test:
    - `GET /health` (public - no auth)
    - `GET /info` (public - no auth)
    - `GET /metrics/queue` (requires auth)

## Queue Contract (Core Business → Notification)

- Mechanism: Queue async
- Topic: `core.notification.alerts`
- Events: `alert.created`, `alert.escalated`, `alert.resolved`

## Smoke test

### Request 1: Health check (no auth)

```http
GET /health
```

```json
No body required
```

### Expected response

```json
{
    "status": "ok",
    "service": "notification-service",
    "version": "1.0.0",
    "timestamp": "2026-05-27T10:00:00Z"
}
```

### Request 2: Queue metrics (with auth)

```http
GET /metrics/queue
Authorization: Bearer mock-token
Content-Type: application/json
```

```json
No body required
```

### Expected response

```json
{
    "queueName": "core.notification.alerts",
    "messageCount": 0,
    "consumerCount": 1
}
```

### Request 3: Queue event smoke test

```http
POST /queue/event (publish to core.notification.alerts)
Authorization: Bearer mock-token
Content-Type: application/json
```

```json
{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "alert.created",
  "occurredAt": "2026-05-27T08:30:00Z",
  "correlationId": "660e8400-e29b-41d4-a716-446655440001",
  "traceId": "770e8400-e29b-41d4-a716-446655440002",
  "source": "core-business",
  "data": {
    "alertId": "880e8400-e29b-41d4-a716-446655440003",
    "severity": "CRITICAL",
    "userId": "user-123",
    "title": "Phát hiện truy cập trái phép",
    "message": "Cửa chính - 27/05/2026 08:30"
  }
}
```

### Expected response

```json
no response
```

## Kết quả

- [✔️] Consumer gọi mock thành công.
- [✔️] Consumer parse được field cần dùng.
- [✔️] Consumer hiểu lỗi 4xx/5xx provider trả về.
- [✔️] Có Newman report hoặc screenshot.

## Ghi chú thay đổi hợp đồng

| Nội dung | Trước | Sau | Người đồng ý |
|---|---|---|---|
| | | | |

## Xác nhận

- Provider representative: Trần Quang Tùng
- Consumer representative:
