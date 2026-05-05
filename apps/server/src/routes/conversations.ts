import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import {
  createConversation,
  getConversationById,
  getConversationsByUser,
  deleteConversation,
  updateConversationTitle,
  getMessagesByConversation,
} from '../db/queries';

const router = Router();
router.use(authMiddleware);

router.get('/', (req: AuthRequest, res: Response) => {
  const conversations = getConversationsByUser(req.userId!);
  res.json(conversations.map(c => ({ id: c.id, title: c.title, createdAt: c.createdAt, updatedAt: c.updatedAt })));
});

router.post('/', (req: AuthRequest, res: Response) => {
  const title: string = req.body?.title ?? 'New Conversation';
  const conv = createConversation(req.userId!, title);
  res.status(201).json({ id: conv.id, title: conv.title, createdAt: conv.createdAt, updatedAt: conv.updatedAt });
});

router.get('/:id', (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const conv = getConversationById(id);
  if (!conv || conv.userId !== req.userId) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  res.json({ id: conv.id, title: conv.title, createdAt: conv.createdAt, updatedAt: conv.updatedAt });
});

router.patch('/:id', (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const conv = getConversationById(id);
  if (!conv || conv.userId !== req.userId) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  const { title } = req.body as { title?: string };
  if (title) updateConversationTitle(id, title);
  const updated = getConversationById(id)!;
  res.json({ id: updated.id, title: updated.title, createdAt: updated.createdAt, updatedAt: updated.updatedAt });
});

router.delete('/:id', (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const conv = getConversationById(id);
  if (!conv || conv.userId !== req.userId) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  deleteConversation(id);
  res.status(204).send();
});

router.get('/:id/messages', (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const conv = getConversationById(id);
  if (!conv || conv.userId !== req.userId) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  const messages = getMessagesByConversation(id);
  res.json(messages.map(m => ({ id: m.id, conversationId: m.conversationId, role: m.role, content: m.content, createdAt: m.createdAt })));
});

export default router;
