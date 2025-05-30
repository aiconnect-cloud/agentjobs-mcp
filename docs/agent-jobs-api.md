# Agent Jobs API Endpoints

This document describes the REST API endpoints available for the Agent Jobs module. These endpoints allow you to create, retrieve, and manage agent jobs programmatically.

## Base URL

All endpoints are prefixed with `/services/agent-jobs`.

## Authentication

All endpoints require authentication using a valid app token with the appropriate access level:

- READ access to the SERVICES scope is required for GET operations
- WRITE access to the SERVICES scope is required for POST and DELETE operations

## Endpoints

### Create a Job

Creates a new agent job.

**Endpoint:** `POST /services/agent-jobs`

**Access Level Required:** WRITE access to SERVICES scope

**Request Body:**

```json
{
  "target_channel": {
    "org_id": "string",
    "platform": "string",
    "type": "string",
    "code": "string",
    "data": {}
  },
  "job_type_id": "string",
  "config": {
    "max_follow_ups": "number",
    "max_task_retries": "number",
    "task_retry_interval": "number",
    "start_prompt": "string",
    "max_time_to_complete": "number",
    "profile_id": "string"
  },
  "params": {},
  "scheduled_at": "string" // Optional ISO 8601 date string
}
```

**Query Parameters:**

- `delay` (optional): A non-negative integer representing the maximum random delay in minutes to add to the scheduled time

**Response:**

```json
{
  "data": {
    "job_id": "string",
    "org_id": "string",
    "channel_code": "string",
    "job_type_id": "string",
    "job_status": "string",
    "created_at": "string",
    "updated_at": "string",
    "scheduled_at": "string",
    "tasks": [],
    "result": null,
    "params": {},
    "config": {}
  },
  "meta": {
    "org_id": "string",
    "id": "string"
  }
}
```

**Status Codes:**

- 201: Job created successfully
- 400: Bad request (missing required fields or invalid format)
- 401: Authentication required
- 404: Job type or organization not found

### Get Jobs

Retrieves a list of jobs for the authenticated organization.

**Endpoint:** `GET /services/agent-jobs`

**Access Level Required:** READ access to SERVICES scope

**Query Parameters:**

- `status`: Filter by job status (WAITING, RUNNING, COMPLETED, FAILED, CANCELED)
- `scheduled_at`: Filter by scheduled time
- `scheduled_at_gte`: Filter by scheduled time greater than or equal to
- `scheduled_at_lte`: Filter by scheduled time less than or equal to
- `created_at_gte`: Filter by creation time greater than or equal to
- `created_at_lte`: Filter by creation time less than or equal to
- `job_type_id`: Filter by job type ID
- `channel_code`: Filter by channel code
- `limit`: Maximum number of jobs to return (pagination)
- `offset`: Number of jobs to skip (pagination)
- `sort`: Sorting field and direction (e.g., `created_at:desc`)

**Response:**

```json
{
  "data": [
    {
      "job_id": "string",
      "org_id": "string",
      "channel_code": "string",
      "job_type_id": "string",
      "job_status": "string",
      "created_at": "string",
      "updated_at": "string",
      "scheduled_at": "string",
      "tasks": [],
      "result": null,
      "params": {},
      "config": {}
    }
  ],
  "meta": {
    "org_id": "string",
    "limit": "number",
    "offset": "number",
    "total": "number",
    "sort": [
      {
        "field": "string",
        "direction": "string"
      }
    ]
  }
}
```

**Status Codes:**

- 200: Success
- 401: Authentication required

### Get Job by ID

Retrieves a specific job by its ID.

**Endpoint:** `GET /services/agent-jobs/:id`

**Access Level Required:** READ access to SERVICES scope

**URL Parameters:**

- `id`: The ID of the job to retrieve

**Response:**

```json
{
  "data": {
    "job_id": "string",
    "org_id": "string",
    "channel_code": "string",
    "job_type_id": "string",
    "job_status": "string",
    "created_at": "string",
    "updated_at": "string",
    "scheduled_at": "string",
    "tasks": [
      {
        "task_id": "string",
        "created_at": "string",
        "status": "string",
        "result": "string"
      }
    ],
    "result": "string",
    "params": {},
    "config": {}
  },
  "meta": {
    "org_id": "string",
    "id": "string"
  }
}
```

**Status Codes:**

- 200: Success
- 400: Bad request (missing job ID)
- 401: Authentication required
- 403: Forbidden (job belongs to a different organization)
- 404: Job not found

### Cancel Job

Cancels a job by changing its status to CANCELED.

**Endpoint:** `DELETE /services/agent-jobs/:id`

**Access Level Required:** WRITE access to SERVICES scope

**URL Parameters:**

- `id`: The ID of the job to cancel

**Request Body (optional):**

```json
{
  "reason": "string" // Optional reason for cancellation
}
```

**Response:**

```json
{
  "meta": {
    "org_id": "string",
    "job_id": "string"
  },
  "message": "Job with ID '{job_id}' successfully canceled"
}
```

**Status Codes:**

- 200: Job successfully canceled
- 400: Bad request (missing job ID)
- 401: Authentication required
- 403: Forbidden (job belongs to a different organization)
- 404: Job not found
- 409: Conflict (job is already in a terminal state)

## Job Status Values

Jobs can have the following status values:

- `WAITING`: Job is waiting to be executed
- `SCHEDULED`: Job is scheduled for future execution
- `RUNNING`: Job is currently running
- `COMPLETED`: Job has completed successfully
- `FAILED`: Job has failed
- `CANCELED`: Job was canceled

## Examples

### Creating a Job for Immediate Execution

```bash
curl -X POST https://api.example.com/services/agent-jobs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_channel": {
      "org_id": "org123",
      "platform": "slack",
      "type": "channel",
      "code": "C123456",
      "data": {
        "channel_id": "C123456",
        "team_id": "T123456"
      }
    },
    "job_type_id": "daily-report",
    "config": {
      "max_follow_ups": 3,
      "max_task_retries": 2,
      "task_retry_interval": 5,
      "max_time_to_complete": 60,
      "profile_id": "profile123"
    },
    "params": {
      "report_type": "daily",
      "include_metrics": true
    }
  }'
```

### Creating a Scheduled Job

```bash
curl -X POST https://api.example.com/services/agent-jobs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "target_channel": {
      "org_id": "org123",
      "platform": "slack",
      "type": "channel",
      "code": "C123456",
      "data": {
        "channel_id": "C123456",
        "team_id": "T123456"
      }
    },
    "job_type_id": "daily-report",
    "config": {
      "max_follow_ups": 3,
      "max_task_retries": 2,
      "task_retry_interval": 5,
      "max_time_to_complete": 60,
      "profile_id": "profile123"
    },
    "params": {
      "report_type": "daily",
      "include_metrics": true
    },
    "scheduled_at": "2023-12-31T09:00:00Z"
  }'
```

### Retrieving Jobs with Filtering

```bash
curl -X GET "https://api.example.com/services/agent-jobs?status=RUNNING&job_type_id=daily-report&limit=10&offset=0&sort=created_at:desc" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Canceling a Job

```bash
curl -X DELETE https://api.example.com/services/agent-jobs/job123 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "No longer needed"
  }'
```
