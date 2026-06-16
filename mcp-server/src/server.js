#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { ApiError } from './errors.js'
import {
  resolveApiKey,
  listBoards,
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  getBoard,
  createTicket,
  moveTicket,
  updateTicket,
  assignTicket,
  deleteTicket,
} from './board-service.js'
import { listAgentSessions } from './agent-service.js'

// The API key identifies which board member the AI acts as. In MCP it is
// supplied through the client config's `env`, scoping every call to that user.
const API_KEY = process.env.FLOWMANCER_API_KEY

let cachedCtx = null
async function getContext() {
  if (cachedCtx) return cachedCtx
  cachedCtx = await resolveApiKey(API_KEY)
  return cachedCtx
}

function ok(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

// Wrap a handler so resolved context + typed errors become clean tool output.
function tool(fn) {
  return async (args) => {
    try {
      const ctx = await getContext()
      const result = await fn(ctx, args || {})
      return ok(result)
    } catch (err) {
      const prefix = err instanceof ApiError ? `[${err.code}] ` : ''
      return { content: [{ type: 'text', text: `Error: ${prefix}${err.message}` }], isError: true }
    }
  }
}

const server = new McpServer({ name: 'flowmancer', version: '1.0.0' })

server.registerTool('whoami', {
  title: 'Who am I',
  description: 'Return the Flowmancer user this API key acts as.',
  inputSchema: {},
}, tool(async (ctx) => ({ uid: ctx.uid, name: ctx.user.name, scopes: ctx.scopes })))

server.registerTool('list_boards', {
  title: 'List boards',
  description: 'List all boards the caller is a member of, with their columns and card counts.',
  inputSchema: {},
}, tool((ctx) => listBoards(ctx)))

server.registerTool('list_projects', {
  title: 'List projects',
  description: 'List the caller\'s projects (id, name, emoji, color). Use a project id as a ticket\'s projectId to link it.',
  inputSchema: {},
}, tool((ctx) => listProjects(ctx)))

server.registerTool('create_project', {
  title: 'Create project',
  description: 'Create a project for the caller. Returns the new project id, which you can use as a ticket\'s projectId.',
  inputSchema: {
    name: z.string().describe('Project name'),
    color: z.string().optional().describe('Hex color, e.g. "#3b82f6" (defaults to blue)'),
    emoji: z.string().optional().describe('Display emoji (defaults to 📁)'),
  },
}, tool((ctx, a) => createProject(ctx, a)))

server.registerTool('update_project', {
  title: 'Update project',
  description: 'Update a project\'s name, color, or emoji. Only provided fields change. Caller must own the project.',
  inputSchema: {
    projectId: z.string().describe('The project id (from list_projects)'),
    name: z.string().optional(),
    color: z.string().optional().describe('Hex color, e.g. "#3b82f6"'),
    emoji: z.string().optional(),
  },
}, tool((ctx, a) => updateProject(ctx, a)))

server.registerTool('delete_project', {
  title: 'Delete project',
  description: 'Permanently delete a project the caller owns. Tickets linked to it keep their projectId but no longer resolve to a project.',
  inputSchema: { projectId: z.string().describe('The project id (from list_projects)') },
}, tool((ctx, a) => deleteProject(ctx, a)))

server.registerTool('get_board', {
  title: 'Get board',
  description: 'Get a single board with all columns and tickets. Use this to discover column names and card ids.',
  inputSchema: { boardId: z.string().describe('The board id (from list_boards)') },
}, tool((ctx, a) => getBoard(ctx, a)))

server.registerTool('create_ticket', {
  title: 'Create ticket',
  description: 'Create a ticket (card) in a column. Column may be its id or its display name (e.g. "To Do").',
  inputSchema: {
    boardId: z.string(),
    column: z.string().describe('Target column id or name'),
    title: z.string(),
    description: z.string().optional(),
    labels: z.array(z.string()).optional(),
    projectId: z.string().optional(),
    assigneeUid: z.string().optional(),
    assigneeEmail: z.string().optional().describe('Assign by member email instead of uid'),
  },
}, tool((ctx, a) => createTicket(ctx, a)))

server.registerTool('move_ticket', {
  title: 'Move ticket',
  description: 'Move a ticket to another column (change its status). Column may be id or name. Appends to the end unless toIndex is given.',
  inputSchema: {
    boardId: z.string(),
    cardId: z.string(),
    toColumn: z.string().describe('Destination column id or name'),
    toIndex: z.number().int().min(0).optional().describe('Position within the destination column'),
  },
}, tool((ctx, a) => moveTicket(ctx, a)))

server.registerTool('update_ticket', {
  title: 'Update ticket',
  description: 'Update a ticket\'s title, description, labels, or project. Only provided fields change.',
  inputSchema: {
    boardId: z.string(),
    cardId: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    labels: z.array(z.string()).optional(),
    projectId: z.string().nullable().optional(),
  },
}, tool((ctx, a) => updateTicket(ctx, a)))

server.registerTool('assign_ticket', {
  title: 'Assign ticket',
  description: 'Assign a ticket to a board member (by uid or email), or set unassign:true to clear it.',
  inputSchema: {
    boardId: z.string(),
    cardId: z.string(),
    assigneeUid: z.string().optional(),
    assigneeEmail: z.string().optional(),
    unassign: z.boolean().optional(),
  },
}, tool((ctx, a) => assignTicket(ctx, a)))

server.registerTool('delete_ticket', {
  title: 'Delete ticket',
  description: 'Permanently delete a ticket from a board.',
  inputSchema: { boardId: z.string(), cardId: z.string() },
}, tool((ctx, a) => deleteTicket(ctx, a)))

server.registerTool('list_agent_sessions', {
  title: 'List agent sessions',
  description: 'List the caller\'s currently-active AI agent sessions (the agents monitor). Each entry is a working agent with its project, task summary, and last heartbeat.',
  inputSchema: {},
}, tool((ctx) => listAgentSessions(ctx)))

async function main() {
  if (!API_KEY) {
    // Fail loudly on stderr so the MCP client surfaces the misconfiguration.
    console.error('FLOWMANCER_API_KEY is not set. The server will reject every tool call.')
  }
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Flowmancer MCP server running on stdio')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
