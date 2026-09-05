const prisma = require('../config/db');
const { runChat } = require('../services/chatOrchestrator');
const { ingestDocument } = require('../services/documentIngestion');
const crypto = require('crypto');
exports.deleteSession = async (req, res) => {
  try {
    const session = await prisma.basePrisma.chatSession.findUnique({
      where: { id: req.params.id }
    });

    if (!session || session.tenantId !== req.user.tenantId || session.userId !== req.user.id) {
      return res.status(404).json({ error: "Session not found." });
    }

    await prisma.basePrisma.chatSession.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

const multer = require('multer');

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

exports.query = async (req, res) => {
  try {
    const { prompt, sessionId: reqSessionId } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required." });

    const ctx = {
      tenantId: req.user.tenantId,
      userId: req.user.id,
      roleLevel: req.user.roleDefinition?.level ?? 1,
    };

    let sessionId = reqSessionId;

    if (!sessionId) {
      // Create new session
      const newSession = await prisma.basePrisma.chatSession.create({
        data: {
          id: crypto.randomUUID(),
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          title: prompt.substring(0, 60) + (prompt.length > 60 ? '...' : '')
        }
      });
      sessionId = newSession.id;
    } else {
      // Verify session ownership
      const session = await prisma.basePrisma.chatSession.findFirst({
        where: { id: sessionId, tenantId: ctx.tenantId, userId: ctx.userId }
      });
      if (!session) return res.status(404).json({ error: "Session not found." });
    }

    // Save user message
    await prisma.basePrisma.chatMessage.create({
      data: {
        id: crypto.randomUUID(),
        sessionId,
        role: 'user',
        content: prompt
      }
    });

    const result = await runChat(ctx, sessionId, prompt, req.app.get('io'));

    // Save model message and tools
    await prisma.basePrisma.chatMessage.create({
      data: {
        id: crypto.randomUUID(),
        sessionId,
        role: 'model',
        content: result.content,
        toolCalls: result.toolCalls ? JSON.stringify(result.toolCalls) : null,
        toolResults: result.toolResults ? JSON.stringify(result.toolResults) : null
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        actorId: ctx.userId,
        action: 'AI_QUERY_EXECUTED',
        targetId: sessionId,
        details: { prompt, entity: 'ChatSession' }
      }
    });

    res.json({ sessionId, text: result.content });
  } catch (error) {
    console.error("Chatbot query error:", error);
    
    if (error.status === 429) {
      return res.status(429).json({ 
        error: "Google Gemini AI Rate Limit Reached. The free tier only allows a limited number of requests per minute. Please wait about 30 seconds and try again." 
      });
    }
    
    if (error.status === 503) {
      return res.status(503).json({ 
        error: "Google's AI servers are currently experiencing high demand and are temporarily unavailable. Please try your request again in a few moments." 
      });
    }

    res.status(500).json({ error: "An error occurred while processing your request." });
  }
};

exports.listSessions = async (req, res) => {
  try {
    const sessions = await prisma.basePrisma.chatSession.findMany({
      where: { tenantId: req.user.tenantId, userId: req.user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, updatedAt: true }
    });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

exports.getSession = async (req, res) => {
  try {
    const session = await prisma.basePrisma.chatSession.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId, userId: req.user.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, role: true, content: true, toolCalls: true, toolResults: true, createdAt: true, feedback: true }
        }
      }
    });
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

exports.deleteSession = async (req, res) => {
  try {
    const session = await prisma.basePrisma.chatSession.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId, userId: req.user.id }
    });
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    await prisma.basePrisma.chatSession.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided." });
    const { title, type, category, accessLevel } = req.body;
    const docTitle = req.file.originalname || title || "Uploaded Document";
    const docType = type || "GENERAL";

    const result = await ingestDocument({
      tenantId: req.user.tenantId,
      title: docTitle,
      type: docType,
      category,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      uploadedById: req.user.id,
      accessLevel
    });

    res.json({ success: true, docTitle, ...result });
  } catch (error) {
    console.error("Document upload error:", error);
    res.status(500).json({ error: "An error occurred during document ingestion." });
  }
};

exports.listDocuments = async (req, res) => {
  try {
    const docs = await prisma.basePrisma.hRDocument.findMany({
      where: { tenantId: req.user.tenantId },
      distinct: ['title', 'type'],
      select: { id: true, title: true, type: true, category: true, accessLevel: true, status: true, createdAt: true }
    });
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

exports.submitFeedback = async (req, res) => {
  try {
    const { feedback } = req.body;
    
    const message = await prisma.basePrisma.chatMessage.findFirst({
      where: { 
        id: req.params.id,
        session: { tenantId: req.user.tenantId, userId: req.user.id }
      }
    });

    if (!message) return res.status(404).json({ error: "Message not found." });

    await prisma.basePrisma.chatMessage.update({
      where: { id: req.params.id },
      data: { feedback }
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

exports.upload = upload;

exports.handleSocketQuery = async (socket, io, data) => {
  try {
    const { prompt, sessionId: reqSessionId, context } = data;
    if (!prompt) {
      socket.emit('chatbot:error', { error: "Prompt is required." });
      return;
    }

    const ctx = {
      tenantId: socket.user.tenantId,
      userId: socket.user.id,
      roleLevel: socket.user.roleDefinition?.level ?? 1,
    };

    if (context && context.alertId) {
      if (ctx.roleLevel > 1) {
        socket.emit('chatbot:error', { error: "Forbidden: You do not have permission to investigate this alert." });
        return;
      }
    }

    let sessionId = reqSessionId;

    if (!sessionId) {
      const newSession = await prisma.basePrisma.chatSession.create({
        data: {
          id: crypto.randomUUID(),
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          title: prompt.substring(0, 60) + (prompt.length > 60 ? '...' : '')
        }
      });
      sessionId = newSession.id;
      socket.emit('chatbot:session', { sessionId });
    } else {
      const session = await prisma.basePrisma.chatSession.findFirst({
        where: { id: sessionId, tenantId: ctx.tenantId, userId: ctx.userId }
      });
      if (!session) {
        socket.emit('chatbot:error', { error: "Session not found." });
        return;
      }
    }

    await prisma.basePrisma.chatMessage.create({
      data: {
        id: crypto.randomUUID(),
        sessionId,
        role: 'user',
        content: prompt
      }
    });

    const result = await runChat(ctx, sessionId, prompt, io, socket, context);

    await prisma.basePrisma.chatMessage.create({
      data: {
        id: crypto.randomUUID(),
        sessionId,
        role: 'model',
        content: result.content || result.text,
        toolCalls: result.toolCalls ? JSON.stringify(result.toolCalls) : null,
        toolResults: result.toolResults ? JSON.stringify(result.toolResults) : null
      }
    });

    await prisma.basePrisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        actorId: ctx.userId,
        action: 'AI_QUERY_SUCCESS',
        targetId: sessionId,
        details: { prompt }
      }
    }).catch(() => {});

    socket.emit('chatbot:done', { sessionId, text: result.content || result.text });
  } catch (error) {
    console.error("Socket chatbot query error:", error);
    socket.emit('chatbot:error', { error: "An error occurred during query execution." });
  }
};
